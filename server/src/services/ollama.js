const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

const analyzeContext = async ({ filename, prompt }) => {
  try {
    console.log(`Sending request to Ollama (${MODEL})...`);
    
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false
    });

    return response.data.response;
  } catch (error) {
    console.error('Ollama API Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Could not connect to Ollama. Is it running?');
    }
    throw error;
  }
};

module.exports = {
  analyzeContext
};
