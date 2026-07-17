# S-Bet - Sports Betting Platform

A modern, next-generation sports betting platform built with Next.js, React, and Tailwind CSS. S-Bet combines robust functionality with seamless user experiences, featuring live matches, real-time odds, customizable interface, and comprehensive sports coverage.

## Features

### 🏠 Homepage & Dashboard
- **Featured Events**: Showcase upcoming major sporting events (Champions League Final, NBA Finals, Wimbledon)
- **Live Matches**: Real-time display of ongoing matches with live scores and possession/statistics
- **Quick Stats**: Dashboard showing live matches count, upcoming events, total bets placed, and win rate
- **Popular Sports**: Visual grid of available sports with match counts
- **Responsive Design**: Mobile and desktop optimized layouts

### ⚽ Multi-Sport Support
- Soccer/Football
- Basketball
- Tennis
- Ice Hockey
- American Football
- Baseball
- Volleyball

### 💳 Betting Features
- **Live Odds**: Display odds in decimal format with home/draw/away options
- **Match Cards**: Beautiful card-based interface for each match showing teams, scores, league, and odds
- **View Full Odds**: Button to access comprehensive betting options for each match
- **Live Indicator**: Visual indicator and animation for live matches

### ⚙️ Settings & Customization
- **Theme Selection**: Dark/Light theme options
- **Color Customization**: 6 secondary color options (Blue, Orange, Green, Purple, Red, Pink)
- **Language Settings**: English, Spanish, French, German language support
- **Date/Time Format**: Multiple date and timezone format options
- **Odds Format**: Decimal, Fractional, and American odds format support
- **Sport Preferences**: Select favorite sports for personalized experience
- **Display Options**: Customize how odds, banners, and handicaps are displayed

### 🧭 Navigation
- **Left Sidebar**: 
  - Main navigation (In-Play, Favorites, Schedule, Results)
  - Sport categories with match counts
  - Other sports section
  - Help and language selector
- **Header**:
  - Search functionality for matches and teams
  - Balance/Wallet display with deposit button
  - Notifications, chat, settings, and user profile

### 🎨 Design System
- **Color Palette**:
  - Background: `#0f1419` (Dark navy)
  - Primary: `#0066cc` (Blue)
  - Accent: `#ff6b35` (Orange)
  - Cards: `#1a1f28` (Dark slate)
  - Text: `#f5f5f7` (Off-white)
- **Typography**: 
  - Headers and UI elements use consistent sans-serif
  - Responsive text sizing
- **Layout**:
  - Fixed sidebar (256px width)
  - Sticky header
  - Main scrollable content area
  - Modal dialogs for settings

## Project Structure

```
├── app/
│   ├── layout.tsx           # Root layout with metadata and providers
│   ├── page.tsx             # Main application page with state management
│   ├── globals.css          # Global styles and design tokens
│   └── next.config.mjs      # Next.js configuration
├── components/
│   ├── sidebar.tsx          # Left navigation sidebar
│   ├── header.tsx           # Top header with search and user menu
│   ├── homepage.tsx         # Main dashboard/homepage
│   ├── match-card.tsx       # Individual match display component
│   └── settings-page.tsx    # Settings and customization modal
├── lib/
│   ├── constants.ts         # Sports, matches, and featured events data
│   └── utils.ts             # Tailwind utility functions
└── public/                  # Static assets and logos
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (or npm/yarn)

### Installation

1. **Clone and install dependencies**:
```bash
cd /vercel/share/v0-project
pnpm install
```

2. **Start the development server**:
```bash
pnpm dev
```

3. **Open in browser**:
```
http://localhost:3000
```

## Core Components

### Sidebar (`components/sidebar.tsx`)
Collapsible left navigation with:
- Main menu items (In-Play, Favorites, Schedule, Results)
- Expandable sports categories
- Badge counters for match counts
- Language and help options

### Header (`components/header.tsx`)
Top sticky bar featuring:
- Search bar for matches and teams
- Wallet balance display
- Deposit button
- Notifications and chat icons
- Settings button
- User profile menu

### Match Card (`components/match-card.tsx`)
Reusable card component displaying:
- League name and match time
- Home/Away team names and live scores
- LIVE indicator for active matches
- Three odds buttons (1/X/2)
- "View full odds" CTA button
- Hover and active states

### Settings Modal (`components/settings-page.tsx`)
Comprehensive customization interface with:
- Theme selection (Dark/Light)
- Secondary color picker (6 options)
- Language selector with timezone
- Odds format selection
- Favorite sports checkboxes
- Display option toggles

### Homepage (`components/homepage.tsx`)
Main dashboard layout with:
- Featured events carousel
- Quick stats grid
- Popular sports overview
- Live matches grid
- Upcoming matches grid

## Mock Data

The application uses mock data stored in `lib/constants.ts`:
- **SPORTS**: Array of 7 sports with icons and match counts
- **LIVE_MATCHES**: Sample matches with teams, scores, odds, and status
- **FEATURED_EVENTS**: Upcoming major sporting events

To integrate real data:
1. Replace mock arrays with API calls
2. Implement real-time updates using WebSockets or polling
3. Add database integration for user preferences and bets

## Styling

### Design Tokens (globals.css)
The application uses CSS custom properties for theming:
- `--background`: Main background color
- `--foreground`: Text color
- `--card`: Card/element background
- `--accent`: Primary accent color (#ff6b35 Orange)
- `--primary`: Primary action color (#0066cc Blue)
- `--destructive`: Error/warning color (red)

### Tailwind CSS
Built with Tailwind CSS v4 with:
- Responsive prefixes (md:, lg:)
- Semantic color usage (text-foreground, bg-card, etc.)
- Custom spacing and gap utilities
- Consistent border and shadow treatment

## Features to Implement

### Phase 2
- [ ] Real sports data integration (ESPN, Odds API)
- [ ] WebSocket updates for live scores
- [ ] User authentication system
- [ ] Wallet and payment integration (Stripe)
- [ ] Betting slip and bet placement
- [ ] User account and preferences persistence
- [ ] Bet history and statistics

### Phase 3
- [ ] Live match visualization/stadium view
- [ ] In-play betting with dynamic odds
- [ ] Cash out functionality
- [ ] Acca/parlay betting
- [ ] Mobile app (React Native)
- [ ] Push notifications
- [ ] Admin dashboard for match management

### Phase 4
- [ ] AI-powered betting recommendations
- [ ] Live chat for match discussions
- [ ] Referral and affiliate system
- [ ] VIP tiers and loyalty rewards
- [ ] Advanced analytics and statistics
- [ ] Responsible gambling tools

## Deployment

### To Vercel
1. Connect your GitHub repository to Vercel
2. Vercel will auto-detect Next.js configuration
3. Deploy with one click

### Environment Variables
Create `.env.local` for development:
```
NEXT_PUBLIC_API_URL=your_api_url
```

## Performance Considerations

- **Code Splitting**: Components are organized to enable route-based splitting
- **Image Optimization**: Use Next.js Image component for all images
- **Responsive Images**: Implemented with Tailwind's responsive prefixes
- **Dark Mode**: CSS custom properties enable instant theme switching
- **CSS-in-JS**: Tailwind enables zero-runtime CSS

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Support

For issues, feature requests, or questions about the S-Bet platform, please create an issue in the repository.

---

**Last Updated**: July 17, 2024
**Version**: 1.0.0 - MVP Release
