/**
 * Sends an SMS message using the Semaphore API.
 *
 * @param {string} apiKey - Your Semaphore API key.
 * @param {string|string[]} number - A single recipient's number or an array of numbers.
 * @param {string} message - The content of the SMS message.
 * @returns {Promise<any>} A promise that resolves with the API response.
 * @throws {Error} Throws an error if the API request fails.
 */
function sendSemaphoreMessage(apiKey, number, message) {
  return new Promise(async (resolve, reject) => {
    const endpoint = 'https://api.semaphore.co/api/v4/messages';

    // Validate required parameters
    if (!apiKey || !number || !message) {
      return reject(new Error('Missing required parameters: apiKey, number, and message are required.'));
    }

    // Note from the API documentation: Do not start your message with "TEST".
    if (message.trim().toUpperCase().startsWith('TEST')) {
      return reject(new Error('Messages starting with "TEST" are silently ignored by the API and will not be sent.'));
    }

    // Construct the form-urlencoded body
    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    // If 'number' is an array, join it into a comma-separated string as per the API docs
    params.append('number', Array.isArray(number) ? number.join(',') : number);
    params.append('message', message);

    params.append('sendername', 'B-Bud Systems');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      // The API is expected to return JSON, even for errors.
      const responseData = await response.json();

      // Check if the HTTP response is not OK (status code not in the 200-299 range)
      if (!response.ok) {
        // Create an error object with details from the API response
        const error = new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        error.response = responseData; // Attach the API's error details
        return reject(error);
      }

      return resolve(responseData);

    } catch (error) {
      // This will catch network errors (e.g., no internet connection) or errors thrown above
      console.error('An error occurred while sending the message:', error);
      // Re-throw the error so the calling function can handle it
      return reject(error);
    }
  });
}

// --- Example Usage ---

(async () => {
  // Replace with your actual API key and recipient's number
  const myApiKey = 'YOUR_API_KEY'; // IMPORTANT: Keep your API key secure!
  const recipientNumber = 'RECIPIENT_PHONE_NUMBER'; // e.g., '15551234567'
  const messageContent = 'Hello from my Node.js application!';

  // --- Example 1: Sending a single message with a custom sender name ---
  try {
    const result = await sendSemaphoreMessage(myApiKey, recipientNumber, messageContent);
    console.log('Message sent successfully! Response:', result);
  } catch (error) {
    console.error('Failed to send message:', error.message);
    if (error.response) {
      console.error('API Error Details:', error.response);
    }
  }

  console.log('\n----------------------------------------\n');

  // --- Example 2: Sending to multiple recipients ---
  const multipleRecipients = ['15551234567', '15557654321'];
  try {
    const result = await sendSemaphoreMessage(myApiKey, multipleRecipients, 'This is a bulk message!');
    // The senderName is omitted, so it will default to "SEMAPHORE"
    console.log('Bulk message sent successfully! Response:', result);
  } catch (error) {
    console.error('Failed to send bulk message:', error.message);
  }
})();