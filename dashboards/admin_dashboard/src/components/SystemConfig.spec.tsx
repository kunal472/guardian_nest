import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SystemConfig } from './SystemConfig';
import * as graphqlService from '../services/graphql';

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn().mockReturnValue({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }),
  };
});

describe('SystemConfig Component', () => {
  const mockConfig: graphqlService.SystemConfigData = {
    yamnetScreamThreshold: 0.65,
    openWakeWordThreshold: 0.75,
    snatchThresholdG: 3.5,
    batteryCriticalThreshold: 0.08,
    deadmanTimeoutMins: 20,
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.spyOn(graphqlService, 'fetchGraphQL').mockImplementation(async (query: string) => {
      if (query.includes('GetSystemConfig')) {
        return { systemConfig: mockConfig } as any;
      }
      if (query.includes('UpdateSystemConfig')) {
        return { updateSystemConfig: mockConfig } as any;
      }
      return null;
    });
  });

  it('should render system configuration and allow threshold tuning and mesh broadcast', async () => {
    render(<SystemConfig />);

    await waitFor(() => {
      expect(screen.getByText('Global Edge ML & Hardware Driver Threshold Tuning')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(5);

    // Adjust all 5 sliders
    fireEvent.change(sliders[0], { target: { value: '0.80' } });
    fireEvent.change(sliders[1], { target: { value: '0.85' } });
    fireEvent.change(sliders[2], { target: { value: '4.2' } });
    fireEvent.change(sliders[3], { target: { value: '0.10' } });
    fireEvent.change(sliders[4], { target: { value: '30' } });

    const broadcastBtn = screen.getByText('Broadcast Dynamic Config to Field Mesh');
    fireEvent.click(broadcastBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dynamic Config deployed over WebSocket mesh/)).toBeInTheDocument();
    });
  });

  it('should handle broadcast error gracefully', async () => {
    vi.spyOn(graphqlService, 'fetchGraphQL').mockImplementation(async (query: string) => {
      if (query.includes('UpdateSystemConfig')) {
        throw new Error('Broadcast mutation failed');
      }
      return null;
    });

    render(<SystemConfig />);
    const broadcastBtn = screen.getByText('Broadcast Dynamic Config to Field Mesh');
    fireEvent.click(broadcastBtn);
  });
});
