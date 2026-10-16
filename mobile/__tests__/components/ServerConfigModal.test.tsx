import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ServerConfigModal } from '../../src/components/ServerConfigModal';

describe('ServerConfigModal Component Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnApply = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(15000);
  });

  it('should render modal content when visible with active URL and live status', () => {
    const { getByText, getByPlaceholderText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={true}
        pingCount={42}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    expect(getByText('📡 Backend Server IP')).toBeTruthy();
    expect(getByText('GATEWAY CONNECTED')).toBeTruthy();
    expect(getByText('Active: http://10.122.65.208:3000')).toBeTruthy();
    expect(getByText('Streamed Pings: 42 updates transmitted')).toBeTruthy();
    expect(getByPlaceholderText('e.g. 10.122.65.208 or 10.122.65.208:3000')).toBeTruthy();
  });

  it('should display offline badge when gateway is disconnected', () => {
    const { getByText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={false}
        pingCount={0}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    expect(getByText('GATEWAY OFFLINE')).toBeTruthy();
  });

  it('should update input and preview when a quick preset chip is clicked', () => {
    const { getByText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={true}
        pingCount={10}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    // Tap Android Emulator preset
    fireEvent.press(getByText('🤖 Android Emul'));
    expect(getByText('http://10.0.2.2:3000')).toBeTruthy();

    // Tap Localhost preset
    fireEvent.press(getByText('💻 Localhost'));
    expect(getByText('http://localhost:3000')).toBeTruthy();
  });

  it('should normalize bare IP and invoke onApply and onClose on submission', () => {
    const { getByPlaceholderText, getByText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={true}
        pingCount={10}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    const input = getByPlaceholderText('e.g. 10.122.65.208 or 10.122.65.208:3000');
    fireEvent.changeText(input, '192.168.1.55');

    fireEvent.press(getByText(/Apply & Connect/));

    expect(mockOnApply).toHaveBeenCalledWith('http://192.168.1.55:3000');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should test ping target server and show success latency', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([]),
    } as any);

    const { getByText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={true}
        pingCount={10}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    fireEvent.press(getByText('Test Ping'));

    await waitFor(() => {
      expect(getByText(/HTTP 200 OK/)).toBeTruthy();
    });

    global.fetch = originalFetch;
  });

  it('should handle ping failure gracefully and show failure message', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error: Connection refused'));

    const { getByText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={false}
        pingCount={0}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    fireEvent.press(getByText('Test Ping'));

    await waitFor(() => {
      expect(getByText(/Network error: Connection refused/)).toBeTruthy();
    });

    global.fetch = originalFetch;
  });

  it('should invoke onClose when Cancel or Close X button is pressed', () => {
    const { getByText } = render(
      <ServerConfigModal
        visible={true}
        currentUrl="http://10.122.65.208:3000"
        isConnected={true}
        pingCount={10}
        onClose={mockOnClose}
        onApply={mockOnApply}
      />
    );

    fireEvent.press(getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('✕'));
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
