import { Sequelize, DataTypes } from 'sequelize';
import * as dotenv from 'dotenv';
import NewsSource from './models/news-source';
import News from './models/news';
import Subscription from './models/subscription';
import Region from './models/region';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  logging: !isProduction,
});

NewsSource.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'news_source',
    underscored: true,
  }
);

News.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    writtenAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'news',
    underscored: true,
  }
);

News.belongsTo(NewsSource, {
  foreignKey: 'news_source_id',
});
NewsSource.hasMany(News, {
  sourceKey: 'id',
  as: 'source',
});

Subscription.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    chatId: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'subscription',
    underscored: true,
  }
);

Region.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'region',
    underscored: true,
  }
);

Subscription.belongsTo(Region, {
  foreignKey: 'region_id',
  as: 'region',
});
Region.hasMany(Subscription, {
  sourceKey: 'id',
  as: 'region',
});

sequelize.sync({ alter: true });

export { sequelize, News, NewsSource, Subscription, Region };
