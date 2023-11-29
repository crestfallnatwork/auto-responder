const { readFileSync } = require('node:fs')

const { validate_user, refresh_access_info } = require('./auth.js')
const { config } = require('./utils.js')

const message_template = readFileSync('message_template.txt')
const gmail = "https://gmail.googleapis.com/gmail/v1/users/me";

let access_info = null;

// validate user then infinitely refresh
const update_access_info = async () => {
  access_info = await validate_user();
  // infinte refreshes :)
  setTimeout(async () => {
    access_info = await refresh_access_info(access_info);
    setTimeout(async () => {
      access_info = await refresh_access_info(access_info);
    }, access_info.expires_in * 1000)
  }, access_info.expires_in * 1000)
}

const auth_header = () => {
  return {
    Authorization: `Bearer ${access_info.access_token}`
  }
}

const send_reply = async (message) => {
  const reply_message = message_template.toString().replace("{from}",
    message.payload.headers.filter(header => header.name == 'To')[0].value ?? "")
    .replace("{to}",
      message.payload.headers.filter(header => header.name == 'From')[0].value ?? "")
    .replace("{subject}",
      message.payload.headers.filter(header => header.name == 'Subject')[0].value ?? "");
  const response = await fetch(`${gmail}/messages/send`,
    {
      method: 'POST',
      body: JSON.stringify({
        threadId: message.threadId,
        raw: Buffer.from(reply_message).toString('base64url')
      }
      ),
      headers: auth_header()
    })
  return await response.json();
}

const mark = async (msg) => {
  const label_id =
    // fetch a list of labels and filter to find our label
    (await ((await fetch(`${gmail}/labels`, { headers: auth_header() })).json()))
      .labels.filter(label => label.name == 'autoreply')[0]?.id
    // make if not exists
    ?? (await (await fetch(`${gmail}/labels`, {
      method: "POST",
      body: JSON.stringify({
        name: "autoreply"
      }),
      headers: auth_header()
    })).json()).id;
  return await (await fetch(`${gmail}/messages/${msg.id}/modify`, {
    method: "POST",
    headers: auth_header(),
    body: JSON.stringify({
      addLabelIds: [label_id]
    })
  })).json()
}

const auto_responder = async () => {
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(`${gmail}/threads?` +
    `q=in:inbox -in:autoreply is:unread category:primary after:${now - config.timeout} before:${now}`,
    { headers: auth_header() }
  );
  // fetch threads with lenght one
  let threads = (await response.json()).threads
  if (!threads) {
    setTimeout(auto_responder, config.timeout*1000);
    return;
  }
  threads = await Promise.all(threads.map(async thread => {
    const response = await fetch(`${gmail}/threads/${thread.id}`, { headers: auth_header() });
    return await response.json();
  }));
  threads = threads.filter(thread => thread.messages.length == 1);
  // reply and mark each thread
  threads.forEach(async thread => {
    const message = await send_reply(thread.messages.at(-1));
    await mark(message);
    const from = thread.messages.at(-1).payload.headers.filter(header => header.name === 'From')[0].value;
    const subject = thread.messages.at(-1).payload.headers.filter(header => header.name === 'Subject')[0]?.value ?? "(no subject)";
    console.table(`${(new Date()).toISOString()} Responded to mail from: "${from}", with subject: "${subject}"`);
  });
  setTimeout(auto_responder, config.timeout*1000);
}

const app = async () => {
  await update_access_info();
  await auto_responder();
}

app().then();
