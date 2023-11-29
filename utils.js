const fs = require("node:fs");
const { os } = require("node:process");
const { exec } = require("node:child_process");

let secret_data = null;
let config_data = null;

const _config = () => {
  if (config_data != null)
    return config_data;
  try {
    config_data = JSON.parse(fs.readFileSync("config.json"));
    return config_data;
  } catch (e) {
    console.error("Failed to parse config data. Quitting...");
    process.exit(1);
  }
}

const _secret = () => {
  if (secret_data != null)
    return secret_data;
  try {
    secret_data = JSON.parse(fs.readFileSync("secret.json")).web;
    return secret_data;
  } catch (e) {
    console.error("Failed to parse secrets data. Quitting...");
    process.exit(1);
  }
}

const open_in_browser = async (url) => {
  let open_command = "";
  switch (os) {
    case "win32":
      open_command = "start";
      break;
    case "darwin":
      open_command = "open";
      break;
    default:
      open_command = "xdg-open";
      break;
  }
  exec(`${open_command} "${url}"`);
};

_config();
_secret();

module.exports = {config: config_data, secret: secret_data, open_in_browser: open_in_browser};
