import * as arctic from "arctic";

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectURI = "http://localhost:3000/api/oauth/google/callback";

console.log(clientId, clientSecret, redirectURI);

if (!clientId && clientSecret) {
    console.log(
        "Dak .env bro need GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET bro"
    );
}

export const google = new arctic.Google(clientId, clientSecret, redirectURI);
