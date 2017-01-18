import db from '../db';

const User = db.import('user', (db, DataTypes) => {
  const { INTEGER, STRING, DATE, JSONB } = DataTypes;

  return db.define('user', {
    id: {
      type: INTEGER,
      allowNull: false,
      primaryKey: true
    },
    username: STRING,
    key: STRING,
    account: STRING,
    token: STRING,
    scrobbles: {
      type: INTEGER,
      defaultValue: 0
    },
    last_scrobble: DATE,
    discogs_results: JSONB
  }, { underscored: true });
});

export default User;