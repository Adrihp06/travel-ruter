# Travel Ruter Frontend

A modern, feature-rich travel planning application built with React, Vite, and Tailwind CSS.

## Features

- **Trip Management**: Create, edit, and organize trips with multi-destination support
- **Interactive Maps**: Mapbox GL integration for route visualization and POI exploration
- **Smart Scheduling**: AI-powered POI scheduling with time optimization
- **Accommodation Booking**: Amadeus API integration for hotel search and booking
- **Day-by-Day Itinerary**: Drag-and-drop itinerary builder with timeline view
- **Offline Support**: PWA with service worker caching
- **Dark Mode**: Full dark mode support with system preference detection
- **Responsive Design**: Mobile-first design that works on all devices

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Maps**: Mapbox GL JS + react-map-gl
- **Drag & Drop**: @dnd-kit
- **Testing**: Vitest + Playwright
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Add your environment variables:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   ```

   Get a Mapbox token at [mapbox.com](https://account.mapbox.com/auth/signup/)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests in watch mode |
| `npm run test:run` | Run unit tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run E2E tests with UI |

## Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Reusable UI components (Button, Input, Toast, etc.)
│   ├── Accommodation/  # Accommodation-related components
│   ├── Hotels/         # Hotel search and booking components
│   ├── Layout/         # Page layout components
│   ├── Map/            # Map-related components
│   ├── POI/            # Points of Interest components
│   ├── Timeline/       # Timeline/itinerary components
│   └── Trip/           # Trip management components
├── contexts/           # React context providers
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API clients and services
├── stores/             # Zustand state stores
└── utils/              # Utility functions
```

## Key Components

### Common UI Components

Located in `src/components/common/`:

- **Button**: Variants (primary, secondary, ghost, danger) + sizes
- **Input**: Text, password, date with validation states
- **Select**: Dropdown with search capability
- **Toast**: Global notification system
- **Alert**: Status messages with variants
- **Progress**: Progress bars and loading indicators
- **ErrorBoundary**: Error catching with fallback UI

### State Management

Zustand stores in `src/stores/`:

- `useTripStore` - Trip CRUD and filtering
- `useDestinationStore` - Destination management
- `usePOIStore` - Points of Interest
- `useAccommodationStore` - Accommodations
- `useHotelSearchStore` - Amadeus hotel search
- `useMapStore` - Map state and interactions

## API Integration

### Backend API

The app connects to a FastAPI backend. Configure the URL in `.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### Amadeus Hotel API

Hotel search is powered by Amadeus API through the backend. No frontend API key is required - all requests are proxied through the backend.

## Security

- **XSS Protection**: All HTML content is sanitized with DOMPurify
- **Error Boundaries**: Graceful error handling prevents crashes
- **Environment Variables**: Sensitive data stored in `.env` (gitignored)

## Testing

### Unit Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run with Playwright UI
npm run test:e2e:ui
```

## Deployment

### Build

```bash
npm run build
```

The build output is in the `dist/` directory.

### Environment Variables for Production

Set these in your hosting platform:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | Yes |
| `VITE_MAPBOX_TOKEN` | Mapbox access token | Yes |

### CI/CD

GitHub Actions workflow is configured for:

- **Lint**: On all PRs
- **Test**: Unit tests with coverage
- **Build**: Production build verification
- **E2E**: Playwright tests (on main branch)
- **Deploy**: Preview on PRs, production on main

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and not licensed for public use.
