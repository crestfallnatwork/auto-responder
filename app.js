const { config } = require("./utils.js")
const { validate_user, refresh_access_info } = require('./auth.js')


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


const app = async () => {
  await update_access_info();
  const gmail = "https://gmail.googleapis.com/gmail/v1";
  const response = await fetch(`${gmail}/users/me/profile`, {
    headers: {
      Authorization: `Bearer ${access_info.access_token}`
    }
  })
  console.log((await response.json()))
}

app().then();
