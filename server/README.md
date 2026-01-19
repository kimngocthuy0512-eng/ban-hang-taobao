# OrderHub Importer

This is the importer server for OrderHub. It is responsible for fetching product data from Taobao and providing it to the main application.

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Create a `.env` file:**
    Copy the `.env.example` file to a new file named `.env`.
    ```bash
    cp .env.example .env
    ```

3.  **Set the `ENCRYPTION_KEY`:**
    Open the `.env` file and replace `your_32_character_encryption_key_here` with a 32-character random string. You can generate one [here](https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new).

## Usage

To start the server, run:
```bash
npm start
```