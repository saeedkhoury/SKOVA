/** Sends every request on www.skova.dev to the same path on https://skova.dev. */
const APEX = 'https://skova.dev';

export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(`${APEX}${url.pathname}${url.search}`, 301);
  },
};
