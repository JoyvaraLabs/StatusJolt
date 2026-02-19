# StatusJolt

A simple, fast status page service built entirely on Cloudflare's stack.

## Features

- 🚀 **Lightning Fast** - Built on Cloudflare's global CDN
- 🛡️ **99.9% Uptime** - Your status page stays up when your services go down
- 🔔 **Smart Notifications** - Email alerts for subscribers
- 🎨 **Custom Branding** - Match your brand colors and use your own domain
- ⚡ **Real-time Updates** - Changes appear instantly
- 🔧 **Developer API** - Automate status updates

## Tech Stack

- **Frontend**: Astro 5.x + Tailwind CSS
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Hosting**: Cloudflare Pages
- **Payments**: Stripe (prepared integration)

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI

### 1. Clone and Install

```bash
git clone https://github.com/JoyvaraLabs/StatusJolt.git
cd StatusJolt
npm install
```

### 2. Setup Cloudflare

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npm run db:create
npm run db:create:dev

# Update wrangler.toml with the generated database IDs
# Then run migrations
npm run db:migrate:dev
npm run db:migrate
```

### 3. Set Environment Variables

In the Cloudflare dashboard, set these variables:

- `JWT_SECRET`: Random string for JWT signing
- `STRIPE_SECRET_KEY`: Your Stripe secret key (optional for now)
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret (optional)

### 4. Deploy

```bash
# Deploy to development
npm run deploy:dev

# Deploy to production  
npm run deploy
```

## Development

```bash
# Start development server
npm run dev

# Use local D1 database
npm run db:migrate:local
```

## API Endpoints

### Public API

- `GET /api/public/status/{subdomain}` - Get public status page data
- `POST /api/public/subscribe` - Subscribe to notifications

### Private API (requires authentication)

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `GET /api/status-pages` - List status pages
- `POST /api/status-pages` - Create status page
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/activity` - Recent activity

## Database Schema

See `schema.sql` for the complete database structure. Key tables:

- `users` - User accounts
- `status_pages` - Status page configurations  
- `components` - Services being monitored
- `incidents` - Service incidents
- `subscribers` - Email subscribers

## Deployment

The app is configured for Cloudflare Pages with Functions. The deploy command builds the Astro app and deploys both static assets and API functions.

```bash
npx wrangler pages deploy dist --project-name statusjolt
```

## Environment Variables

**Required:**
- `JWT_SECRET` - For authentication tokens

**Optional:**
- `STRIPE_SECRET_KEY` - For payment processing
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Add tests if needed
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, please open a GitHub issue or contact support@statusjolt.com.