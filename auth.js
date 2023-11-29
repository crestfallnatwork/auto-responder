/*
 * This File contains functions to authenticate users and
 * get access tokens.
 */

const fs = require("node:fs");
const http = require("node:http");

const { config, secret, open_in_browser } = require("./utils.js")

// this function sends the auth request to the oauth server
// : part of new user auth validation chain
const _send_auth_request = async () => {
  const scopes =
    "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels";
  // Better to use the URL object instead
  const auth_url = encodeURI(
    `${secret.auth_uri}?` +
    `response_type=code&` +
    `access_type=offline&` +
    `client_id=${secret.client_id}&` +
    `scope=${scopes}&` +
    `redirect_uri=${secret.redirect_uris[0]}`,
  );
  console.log("Open this link if browser not automatically opened: " + auth_url);
  await open_in_browser(auth_url);
};

// this function waits and fetches the auth token after the user authenticates
// : part of new user validation chain
const _get_auth_code = async () => {
  const server = http.createServer();
  // take a resolve a request and put it in a promise
  const auth_token_promise = new Promise((resolve, reject) => {
    server.once("request", function (req, res) {
      // better checking of the url would be valuable
      if ((array = /(?<=code=)(.*)(?=\&)/.exec(decodeURIComponent(req.url))) !== null) {
        resolve(array[0]);
      } else {
        reject("Unauthorized Access");
      }
      res.statusCode = 200;
      res.end("");
      return;
    });
    server.listen(config.port);
  });
  const auth_code = await auth_token_promise;
  server.close();
  return auth_code;
};

// get access token using authentication code
// : part of new user validation chain
const _get_access_token = async (auth_code) => {
  const response = await fetch(secret.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeURI(
      `grant_type=authorization_code&` +
      `code=${auth_code}&` +
      `client_id=${secret.client_id}&` +
      `client_secret=${secret.client_secret}&` +
      `redirect_uri=${secret.redirect_uris[0]}`,
    ),
  });
  if (response.status != 200) {
    throw await response.json();
  }
  const access_info = await response.json();
  access_info.expires_in = access_info.expires_in - 10;
  // presist the refresh token
  fs.writeFileSync("access_info.json", JSON.stringify(access_info));
  return access_info;
};

// validates new users and presists them
const _validate_new_user = async () => {
  try {
    await _send_auth_request();
    const auth_code = await _get_auth_code();
    const access_info = await _get_access_token(auth_code);
    return access_info;
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

// main user validation function checks if a user exists or validates a new one
const validate_user = async () => {
  if (!fs.existsSync('access_info.json')) {
    return await _validate_new_user();
  }
  const access_info = await refresh_access_info(JSON.parse(fs.readFileSync('access_info.json')));
  return access_info;
}

// refreshes access token
const refresh_access_info = async (access_info) => {
  const refresh_token = access_info.refresh_token;
  const response = await fetch(secret.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeURI(
      `grant_type=refresh_token&` +
      `refresh_token=${refresh_token}&` +
      `client_id=${secret.client_id}&` +
      `client_secret=${secret.client_secret}&`
    ),
  });
  if (response.status != 200) {
    console.log(response.statusText)
    access_info = await _validate_new_user();
    return access_info;
  }
  access_info = await response.json();
  access_info.refresh_token = refresh_token;
  access_info.expires_in = access_info.expires_in - 10;
  return access_info;
}

module.exports = { validate_user: validate_user, refresh_access_info: refresh_access_info }
