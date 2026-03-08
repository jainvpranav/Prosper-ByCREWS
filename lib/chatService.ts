export async function sendChatMessage(message: string, userId?: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Lambda reads event.get("inputText"), so we send it under that key
      body: JSON.stringify({ inputText: message, userId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get response from AI');
    }

    const data = await response.json();

    // Lambda returns { response, sessionId } inside body (may be double-JSON-encoded by API GW)
    const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    return parsed.response || parsed.message || "I'm sorry, I couldn't process that.";
  } catch (error: any) {
    console.error('Chat Service Error:', error);
    throw error;
  }
}
