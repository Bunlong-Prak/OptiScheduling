const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectURI = `${process.env.DOMAIN}/api/oauth/google/callback`;

if (!clientId && clientSecret) {
    console.log(
        "Dak .env bro need GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET bro"
    );
}

export const google = new arctic.Google(clientId, clientSecret, redirectURI);
import * as arctic from "arctic";

// const clientId = process.env.GOOGLE_CLIENT_ID || "";
// const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
// const redirectURI = `${process.env.DOMAIN}/api/oauth/google/callback`;

// if (!clientId && clientSecret) {
//     console.log(
//         "Dak .env bro need GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET bro"
//     );
// }
