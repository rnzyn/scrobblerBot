import Telegraf from 'telegraf';
import crypto from 'crypto';
import querystring from 'querystring';
import fetch from 'node-fetch';
import songs from '../songs';
import { findUserByIdAndUpdate, createSucceededMessage, createFailedMessage } from './dbmanager';
import { ADMIN_ID, SCROBBLERBOT_TOKEN } from '../../config';
import { setProxyEnabled } from './proxy';


const telegram = new Telegraf.Telegram(SCROBBLERBOT_TOKEN);
export const GLOBAL_KEYBOARD = Telegraf.Markup.keyboard([['🎵 Track', '💽 Album', '📃 Tracklist']]).resize().extra();

export function sendToAdmin(text) {
  return telegram.sendMessage(ADMIN_ID, text);
}

export function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

export function getRandomFavSong() {
  const index = Math.floor(Math.random() * songs.length);
  return songs[index];
}

export async function error(ctx, e) {
  if (e.code === 400) { // message is not modified
    return;
  }

  console.log(e);
  const errText = '❗️ Oops, something went wrong. Please try again later.';

  if (ctx.callbackQuery) {
    await ctx.editMessageText(errText);
  } else if (ctx.inlineQuery) {
    // pass
  } else {
    await ctx.reply(errText);
  }

  if (ctx.flow) await ctx.flow.leave();
  await sendToAdmin('❗️ An error occured. Check the logs...');
}

export function utf8(text) {
  return decodeURI(decodeURIComponent(text));
}

export async function successfulScrobble(ctx, text = '✅ Scrobbled', tracks = []) {
  await findUserByIdAndUpdate(ctx.from.id, {
    $inc: { scrobbles: 1 },
    username: ctx.from.username,
    last_scrobble: new Date(),
    album: {},
    track: {},
  });

  const extra = Telegraf.Markup.inlineKeyboard([
    Telegraf.Markup.callbackButton('Repeat', 'REPEAT'),
  ]).extra();

  let message;

  if (ctx.callbackQuery) {
    message = await ctx.editMessageText(text, extra);
  } else if (ctx.flow.state.messageIdToEdit) {
    message = await ctx.telegram
      .editMessageText(ctx.chat.id, ctx.flow.state.messageIdToEdit, null, text, extra);
  } else {
    message = await ctx.reply(text, extra);
  }

  await createSucceededMessage(message.message_id, tracks);
  await ctx.flow.leave();
}

export function canScrobble(ctx) {
  if (!ctx.user || Date.now() - +ctx.user.last_scrobble <= 30000) {
    return false;
  }

  return true;
}

export function multipleArray(array = [], multipleTimes = 1) {
  let multipliedArray = [];

  if (multipleTimes > 1) {
    for (let i = 0; i < multipleTimes; i += 1) {
      multipliedArray = multipliedArray.concat(array);
    }

    return multipliedArray;
  }

  return array;
}

export async function requestError(ctx, e) {
  if (!e.response) throw new Error('Haven\'t got any response');

  if (e.code === 429) { // too many requests
    console.log(e.response);
    await sendToAdmin(`${e.message}\n\nActivating proxy mode... ${setProxyEnabled(true)}`);
    return;
  }

  const err = e.response.error;

  if (err === 14 || err === 4 || err === 9) {
    const text = '❌ Access has not been granted. Please re-authenticate';

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text);
    } else {
      await ctx.reply(text);
    }

    await ctx.flow.enter('auth');
  }
}

export async function scrobbleError(ctx, e, tracks = [], msg = '❌ Failed') {
  const extra = Telegraf.Markup.inlineKeyboard([
    Telegraf.Markup.callbackButton('Retry', 'RETRY'),
  ]).extra();

  let messageId;

  if (ctx.flow.state.messageIdToEdit) {
    messageId = ctx.flow.state.messageIdToEdit;
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, msg, extra);
  } else if (ctx.callbackQuery) {
    messageId = ctx.callbackQuery.message.message_id;
    await ctx.editMessageText(msg, extra);
  } else {
    const res = await ctx.reply(msg, extra);
    messageId = res.message_id;
  }

  if (tracks.length) {
    await createFailedMessage(messageId, tracks);
  }

  if (e) await requestError(ctx, e);
  await ctx.flow.leave();
}

export function isUserAuthorized(ctx) {
  return ctx.user && ctx.user.key;
}

export function isUserAdmin(ctx) {
  return ctx.from.id === +ADMIN_ID;
}

export function validateTrackDurations(tracks = []) {
  const defDur = 300;
  return tracks.map((track) => {
    let duration = 0;
    const td = track.duration;

    if (tracks.length === 1) {
      return Object.assign(track, { duration });
    }

    duration = typeof td === 'undefined' ? defDur : +td || defDur;
    return Object.assign(track, { duration });
  });
}

export async function httpRequest(url = '', options = {}) {
  const opts = Object.assign({}, options);
  opts.headers = Object.assign(opts.headers || {}, {
    'User-Agent': 'telegram@scrobblerBot/1.0.0 (+https://github.com/drvirtuozov/scrobblerBot)',
  });
  const res = await fetch(url, opts);
  const json = await res.json();

  if (res.status !== 200) {
    const err = new Error(res.statusText);
    err.code = res.status;
    err.response = json;
    throw err;
  }

  return json;
}

export function httpPost(url = '', data = {}, opts = {}) {
  return httpRequest(url, Object.assign({
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: typeof data === 'string' ? data : querystring.stringify(data),
  }, opts));
}

export function httpGet(url = '', opts = {}) {
  return httpRequest(url, Object.assign({
    method: 'GET',
  }, opts));
}

export function getIgnoredTracksFromLastfmRes(res = {}) {
  if (!res.scrobbles) return [];
  const ignored = [];
  const scrobbles = res.scrobbles.scrobble;

  if (Array.isArray(scrobbles)) {
    scrobbles.filter(scr => scr.ignoredMessage.code === '1')
      .forEach(scr => ignored.push(scr));
  } else if (scrobbles.ignoredMessage.code === '1') {
    ignored.push(scrobbles);
  }

  return ignored.map(track => ({
    artist: track.artist['#text'],
    name: track.track['#text'],
    album: track.album['#text'],
  }));
}
