import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BreadcrumbLog } from './BreadcrumbLog';

describe('BreadcrumbLog Component', () => {
  it('renders empty state message when no logs exist', () => {
    render(<BreadcrumbLog logs={[]} />);
    expect(screen.getByText(/0 Pings Cached/i)).toBeInTheDocument();
    expect(screen.getByText(/No GPS trail recorded yet/i)).toBeInTheDocument();
  });

  it('renders GPS breadcrumb items with lat/lng and battery percentages', () => {
    const logs = [
      {
        lat: 18.52043,
        lng: 73.85674,
        batteryLevel: 85,
        loggedAt: '2026-09-20T10:00:00Z',
      },
      {
        lat: 18.5215,
        lng: 73.8578,
        batteryLevel: 15,
        loggedAt: '2026-09-20T10:01:00Z',
      },
    ];

    render(<BreadcrumbLog logs={logs} />);
    expect(screen.getByText(/2 Pings Cached/i)).toBeInTheDocument();
    expect(screen.getByText(/18.52043, 73.85674/i)).toBeInTheDocument();
    expect(screen.getByText(/18.52150, 73.85780/i)).toBeInTheDocument();
    expect(screen.getByText(/85%/i)).toBeInTheDocument();
    expect(screen.getByText(/15%/i)).toBeInTheDocument();
  });
});
