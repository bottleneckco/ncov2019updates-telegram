import * as dotenv from 'dotenv';
import { createHandyClient } from 'handy-redis';
import { Region, Subscription } from './db';
dotenv.config();

import Telegraf, {
  ContextMessageUpdate,
  BaseScene,
  Stage,
  session,
  SceneContextMessageUpdate,
} from 'telegraf';

const { TELEGRAM_BOT_TOKEN } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing bot token');
}

const redisClient = createHandyClient({
  url: process.env.REDIS_URL,
});

const bot: Telegraf<SceneContextMessageUpdate> = new Telegraf(
  TELEGRAM_BOT_TOKEN
);

// Scenes

const statusScene = new BaseScene('status');
statusScene.on('message', async ctx => {
  const regionName = ctx.message?.text;
  const region = await Region.findOne({
    where: { name: regionName || '' },
  });
  if (!region) {
    ctx.reply('Region not found!', {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.scene.leave();
    return;
  }

  const data = await redisClient.hgetall(`BNO.${ctx.message?.text}`);
  await ctx.reply(
    Object.keys(data)
      .map(key => `${key.toUpperCase()}: *${data[key]}*`)
      .join('\n'),
    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
  );
  await ctx.scene.leave();
});

const subscribeScene = new BaseScene('subscribe');
subscribeScene.on('message', async ctx => {
  const regionName = ctx.message?.text;
  const region: Region = await Region.findOne({
    where: { name: regionName || '' },
  });
  if (!region) {
    ctx.reply('Region not found!', {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.scene.leave();
    return;
  }

  const subscription: Subscription = await Subscription.findOrCreate({
    where: {
      chatId: (await ctx.getChat()).id,
      region_id: region.id,
    },
  });

  if (!subscription) {
    ctx.reply('Error subscribing', {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.scene.leave();
    return;
  }

  ctx.reply(`Subscribed to '${regionName}'`, {
    reply_markup: { remove_keyboard: true },
  });
  await ctx.scene.leave();
});

const unsubscribeScene = new BaseScene('unsubscribe');
unsubscribeScene.on('message', async ctx => {
  const regionName = ctx.message?.text;
  const region: Region = await Region.findOne({
    where: { name: regionName || '' },
  });
  if (!region) {
    ctx.reply('Region not found!', {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.scene.leave();
    return;
  }

  const subscription: Subscription = await Subscription.findOne({
    where: {
      chatId: (await ctx.getChat()).id,
      region_id: region.id,
    },
  });

  if (!subscription) {
    ctx.reply(`You do not have a subcription to '${regionName}'`, {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.scene.leave();
    return;
  }

  await subscription.destroy();
  ctx.reply(`Unsubscribed from '${regionName}'`, {
    reply_markup: { remove_keyboard: true },
  });

  await ctx.scene.leave();
});

const stage = new Stage([statusScene, subscribeScene, unsubscribeScene]);
stage.command('cancel', Stage.leave());

bot.use(session());
bot.use(stage.middleware());

// Message handlers
async function displayRegionsKeyboard(
  ctx: ContextMessageUpdate
): Promise<void> {
  const regions = await Region.findAll();

  ctx.reply('Choose a region', {
    reply_markup: {
      one_time_keyboard: true,
      keyboard: regions.map((region: Region) => [region.name]),
    },
  });
}

bot.start((ctx: ContextMessageUpdate) =>
  ctx.reply('Hi there!\nYou can try /status for a start.')
);

bot.command('status', async ctx => {
  await ctx.scene.enter('status');
  await displayRegionsKeyboard(ctx);
});

bot.command('subscribe', async ctx => {
  await ctx.scene.enter('subscribe');
  await displayRegionsKeyboard(ctx);
});

bot.command('unsubscribe', async ctx => {
  const subscriptions = await Subscription.findAll({
    attributes: ['region_id'],
    where: {
      chatId: (await ctx.getChat()).id,
    },
    include: ['region'],
  });

  if (subscriptions.length === 0) {
    await ctx.reply('You do not have any subscriptions');
    return;
  }

  await ctx.scene.enter('unsubscribe');
  ctx.reply('Choose a subscription', {
    reply_markup: {
      one_time_keyboard: true,
      keyboard: subscriptions.map((sub: Subscription) => [sub.region.name]),
    },
  });
});

bot.command('subscriptions', async ctx => {
  const subscriptions = await Subscription.findAll({
    attributes: ['region_id'],
    where: {
      chatId: (await ctx.getChat()).id,
    },
    include: ['region'],
  });

  if (subscriptions.length === 0) {
    await ctx.reply('You do not have any subscriptions');
    return;
  }

  await ctx.reply(
    `*Subscriptions*:\n${subscriptions
      .map((sub: Subscription) => `- ${sub.region.name}`)
      .join('\n')}                  `,
    { parse_mode: 'Markdown' }
  );
});

bot.command('sources', ctx =>
  ctx.reply(
    `*Our sources:*
- BNO NEWS
- Ministry of Health, Republic of Singapore
- National Health Commission, People's Republic of China`,
    { parse_mode: 'Markdown' }
  )
);

if (process.env.NODE_ENV === 'production') {
  bot.launch({
    webhook: {
      domain: process.env.TELEGRAM_WEBHOOK_DOMAIN,
      port: parseInt(process.env.PORT!),
      hookPath: '/webhook',
    },
  });
} else {
  bot.launch();
}
