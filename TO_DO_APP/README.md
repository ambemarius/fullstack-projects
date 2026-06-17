# TO_DO_APP

A full-stack Todo application built with Node.js, Express, and MongoDB. This application allows users to create, read, update, and delete (CRUD) todo items.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Setup and Installation](#setup-and-installation)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [Deployment](#deployment)

## Prerequisites
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account and a cluster set up.

## Setup and Installation

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd TO_DO_APP
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your MongoDB connection string and preferred port:
   ```env
   DB_STRING=mongodb+srv://yourUsername:yourPassword@yourCluster.mongodb.net/yourDatabaseName?retryWrites=true&w=majority
   PORT=2121
   ```

## Project Structure

- **`node_modules/`**: Contains all the project's dependencies installed via npm.
- **`public/`**: Stores static files that are served to the client.
    - **`css/style.css`**: Contains the styling for the application.
    - **`js/main.js`**: Contains the client-side JavaScript for handling UI interactions and API calls.
- **`views/`**: Contains the EJS templates for rendering HTML.
    - **`index.ejs`**: The main page template that displays the todo list and form.
- **`.env`**: (User-created) Stores sensitive configuration like database credentials.
- **`.gitignore`**: Specifies files and folders that Git should ignore (e.g., `node_modules`, `.env`).
- **`package.json`**: Defines the project metadata, scripts, and dependencies.
- **`server.js`**: The entry point of the application. It sets up the Express server, connects to MongoDB, and defines the API routes.

## How to Run

To start the server in production mode:
```bash
npm start
```
Or simply:
```bash
node server.js
```

The application will be running at `http://localhost:2121` (or your specified port).

## API Endpoints

- **`GET /`**: Renders the index page with all todo items.
- **`POST /addTodo`**: Adds a new todo item to the database.
- **`PUT /markComplete`**: Marks a specific todo item as completed.
- **`PUT /markUnComplete`**: Marks a completed todo item as incomplete.
- **`DELETE /deleteItem`**: Deletes a todo item from the database.
