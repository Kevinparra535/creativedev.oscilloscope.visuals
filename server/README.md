# Oscilloscope Visuals - Backend Server

This is the backend server for the Oscilloscope Visuals project. It handles audio file uploads and communicates with a local Ollama AI instance to analyze the content.

## Prerequisites

1. **Node.js** installed.
2. **Ollama** installed and running locally.
    * Download from [ollama.com](https://ollama.com).
    * Pull the model: `ollama pull llama3.1`
    * Start the server (usually runs automatically or via `ollama serve`).

## Setup

1. Navigate to the server directory:

    ```bash
    cd server
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file (optional, defaults provided):

    ```env
    PORT=3001
    OLLAMA_URL=http://localhost:11434
    OLLAMA_MODEL=llama3.1
    ```

## Running

* **Development**:

    ```bash
    npm run dev
    ```

* **Production**:

    ```bash
    npm start
    ```

## API Endpoints

* `POST /api/analyze/audio`: Upload an audio file for analysis.
  * Body: `FormData` with key `audio` (file).
* `GET /health`: Check server status.
