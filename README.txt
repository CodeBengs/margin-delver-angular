# Margin Delver — Angular Frontend

## Development Setup

### Prerequisites

- Install [Node.js](https://nodejs.org/) (18.19.1+, Node 20 LTS recommended) which includes Node Package Manager
- To be able to change the Node.js environment easily, we recommend that you install [NVM](https://github.com/nvm-sh/nvm)

### Setting Up a Project

Install the Angular CLI globally:

```bash
npm install -g @angular/cli
```

Clone the project:

```bash
git clone <repo-url>
```

Install dependencies:

- Go to project directory
- Open new terminal as Administrator
- Install packages using `npm install` command

### API URL Setup

Open & edit file [proxy.conf.json](proxy.conf.json):

```json
{
  "/internal/v1": {
    "target": "{backendUrl}",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

Replace `{backendUrl}` with the backend API URL (default: `http://localhost:3030`).

### Run the Application

```bash
npm start
```

Open browser and visit:

```
http://localhost:4500
```

### Build the Application

```bash
npm run build
```

---

## Tech Stack

**Client:** Angular 19, RxJS, SCSS (Pujasera Design System)

**Server:** Go, REST API at `/internal/v1`

---

## Related

Here are some related projects:

- [Margin Delver Backend](../margin-delver)
