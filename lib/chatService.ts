export async function sendChatMessage(message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get response from AI');
    }

    const data = await response.json();
    
    // API Gateway response might be wrapped or simple
    // Based on the curl test it returns {"message": ...}
    return data.message || data.response || "I'm sorry, I couldn't process that.";
  } catch (error: any) {
    console.error('Chat Service Error:', error);
    throw error;
  }
}
