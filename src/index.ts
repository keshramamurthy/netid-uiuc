import express from "express";
import axios from "axios";
import msal from "@azure/msal-node";
import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("config.json", "utf-8"));
const clientConfiguration = JSON.parse(readFileSync("scenarioConfig.json", "utf-8"));

const app = express();

const msalConfig: msal.Configuration = {
    auth: {
        clientId: clientConfiguration.authOptions.clientId,
        authority: clientConfiguration.authOptions.authority,
        clientSecret: config.clientSecret,
    }
};
const msalApp = new msal.PublicClientApplication(msalConfig);

app.get("/authorize", async (req, res) => {
    const { authCodeUrlParameters } = clientConfiguration.request;

    const link = await msalApp.getAuthCodeUrl(authCodeUrlParameters)
    res.redirect(link);
});

app.get("/redirect", async (req, res) => {
    const tokenRequest = { ...clientConfiguration.request.tokenRequest, code: req.query.code };
    
    try {
        const response = await axios.post(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
            redirect_uri: tokenRequest.redirectUri,
            scopes: tokenRequest.scopes,
            code: req.query.code,
            grant_type: "authorization_code",
            client_id: clientConfiguration.authOptions.clientId,
            client_secret: config.clientSecret
        }, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        
        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;

        const userData = await axios.get("https://graph.microsoft.com/v1.0/me", {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (userData.data.mail.endsWith("@illinois.edu")) {
            res.send(JSON.stringify(userData.data, null, 4));
        } else {
            res.status(403).send("You haven't signed up with your Illinois email! Return to the home page and retry with a valid illinois.edu email address.");
        }
    } catch (e) {
        console.error(e);
        res.status(500).send("Internal System Error");
    }
})

app.listen(80, () => {
    console.log("App listening on port 80");
});