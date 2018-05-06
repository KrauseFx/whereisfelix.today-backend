# `whereisfelix.today`

## Development dependencies

```
npm install
```

## Server

```
npm run dev
```

## Frontend

For development

```
cd frontend
ng serve
```

## Instagram

Since the Instagram API isn't perfect right now, and probably never will in the near future, this is how you can renew the access token:

- Get the `Client ID` from [instagram.com/developer/clients/manage](https://instagram.com/developer/clients/manage/)
- Open `https://www.instagram.com/oauth/authorize/?client_id=[Client ID]&redirect_uri=whereisfelix.today&response_type=token`
- Copy & paste the Access Token from the resulting URL after confirming and set it as ENV variable for `INSTAGRAM_ACCESS_TOKEN`
