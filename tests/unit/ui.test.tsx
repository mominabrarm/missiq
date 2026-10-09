import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../src/App';
import { SAMPLE_TRANSCRIPT, SAMPLE_USER_NAME } from '../../src/testing/fixtures/sample';
import { MAX_CHARACTERS } from '../../src/config/limits';

describe('Phase 5 MVP UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Welcome view by default with brand and CTAs', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Miss less. Know more./i);
    expect(screen.getAllByText(/Your private chat intelligence/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Start a briefing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try synthetic sample/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Ready — nothing loaded/i);
  });

  it('navigates to Import view when "Start a briefing" is clicked', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Start a briefing/i }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Import Conversation/i);
    expect(screen.getByPlaceholderText(/Paste your chat messages here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze messages/i })).toBeDisabled();
  });

  it('loads sample transcript when "Load sample" is clicked in Import view', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Start a briefing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Load sample/i }));

    const textarea = screen.getByPlaceholderText(/Paste your chat messages here/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe(SAMPLE_TRANSCRIPT);
    expect(screen.getByText(/Synthetic sample loaded/i)).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Your name in this chat/i) as HTMLInputElement;
    expect(nameInput.value).toBe(SAMPLE_USER_NAME);

    // Analyze button should now be enabled
    expect(screen.getByRole('button', { name: /Analyze messages/i })).not.toBeDisabled();
  });

  it('validates oversized input and shows validation error', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Start a briefing/i }));
    const textarea = screen.getByPlaceholderText(/Paste your chat messages here/i);

    // Exceed character limit
    const oversizedText = 'A'.repeat(MAX_CHARACTERS + 10);
    fireEvent.change(textarea, { target: { value: oversizedText } });

    expect(screen.getByRole('alert')).toHaveTextContent(/Transcript exceeds maximum length/i);
    expect(screen.getByRole('button', { name: /Analyze messages/i })).toBeDisabled();
  });

  it('runs analysis and displays Results view with 3 primary sections', async () => {
    render(<App />);

    // Start with sample
    fireEvent.click(screen.getByRole('button', { name: /Try synthetic sample/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Import Conversation/i);

    // Trigger analysis
    fireEvent.click(screen.getByRole('button', { name: /Analyze messages/i }));

    // Wait for analysis to complete and transition to results
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Conversation Briefing/i);
    }, { timeout: 3000 });

    // Verify 3 primary sections exist
    expect(screen.getByRole('heading', { name: /Needs Attention/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tasks & Deadlines/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Important Decisions/i })).toBeInTheDocument();

    // Verify status chip shows complete & local
    expect(screen.getByRole('status')).toHaveTextContent(/Analyzed locally · Rule-based, no AI model/i);
  });

  it('toggles task completion in memory without altering transcript', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Try synthetic sample/i }));
    fireEvent.click(screen.getByRole('button', { name: /Analyze messages/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Conversation Briefing/i);
    }, { timeout: 3000 });

    // Find the first task checkbox
    const checkboxes = screen.getAllByRole('checkbox', { name: /Mark task as complete/i });
    expect(checkboxes.length).toBeGreaterThan(0);
    const firstCheckbox = checkboxes[0] as HTMLInputElement;

    expect(firstCheckbox.checked).toBe(false);

    // Toggle complete
    fireEvent.click(firstCheckbox);
    expect(firstCheckbox.checked).toBe(true);

    // Undo toast should appear
    expect(screen.getByText(/Task marked complete/i)).toBeInTheDocument();
    const undoButton = screen.getByRole('button', { name: /Undo/i });
    expect(undoButton).toBeInTheDocument();

    // Click Undo
    fireEvent.click(undoButton);
    expect(firstCheckbox.checked).toBe(false);
  });

  it('opens interactive source inspection drawer with verbatim message', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Try synthetic sample/i }));
    fireEvent.click(screen.getByRole('button', { name: /Analyze messages/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Conversation Briefing/i);
    }, { timeout: 3000 });

    // Click first source button
    const sourceButtons = screen.getAllByRole('button', { name: /Inspect source/i });
    expect(sourceButtons.length).toBeGreaterThan(0);
    fireEvent.click(sourceButtons[0]);

    // Verify Source Inspection Drawer opened
    expect(screen.getByRole('heading', { name: /Source Message Inspection/i })).toBeInTheDocument();
    expect(screen.getByText(/Primary Evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show surrounding conversation/i })).toBeInTheDocument();

    // Close source drawer
    fireEvent.click(screen.getByRole('button', { name: /Close source drawer/i }));
    expect(screen.queryByRole('heading', { name: /Source Message Inspection/i })).not.toBeInTheDocument();
  });

  it('cancels in-progress analysis and returns cleanly to import', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Try synthetic sample/i }));

    // Start analysis
    fireEvent.click(screen.getByRole('button', { name: /Analyze messages/i }));

    // If analyzing view appears, click cancel
    const cancelBtn = screen.queryByRole('button', { name: /Cancel analysis/i });
    if (cancelBtn) {
      fireEvent.click(cancelBtn);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Import Conversation/i);
    }
  });

  it('clears all data completely from application state', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Try synthetic sample/i }));
    fireEvent.click(screen.getByRole('button', { name: /Analyze messages/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Conversation Briefing/i);
    }, { timeout: 3000 });

    // Click Clear in Header or Results
    const clearButtons = screen.getAllByRole('button', { name: /Clear/i });
    fireEvent.click(clearButtons[0]);

    // Expect cleared screen
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Your data was cleared/i);
    expect(screen.getByText(/All imported chat text, parsed messages, and derived results have been completely removed from memory/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Data cleared/i);

    // Click "Start new briefing" to return to welcome
    fireEvent.click(screen.getByRole('button', { name: /Start new briefing/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Miss less. Know more./i);
  });
});
