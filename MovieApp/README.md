# Movie App

A simple and responsive web application that allows users to browse popular movies and search for specific titles using The Movie Database (TMDb) API.

## Features

- **Home Page**: Displays a list of currently popular movies.
- **Search Functionality**: Search for movies by title using the search bar.
- **Movie Details**: Each movie card shows the title, rating, and poster.
- **Rating Colors**: Movie ratings are color-coded (Green for high, Orange for medium, Red for low).
- **Overview Overlay**: Hover over a movie card to see a brief description of the movie.
- **Responsive Design**: Works on desktops, tablets, and mobile devices.

## Tech Stack

- **HTML5**: Semantic structure.
- **CSS3**: Custom styling, Flexbox for layout, and transitions for animations.
- **JavaScript (ES6+)**: Fetch API for asynchronous data retrieval and DOM manipulation.
- **TMDb API**: External data source for movie information.

## How to Set Up and Run

Follow these steps to get the project running locally:

### 1. Prerequisites
- A web browser (Chrome, Firefox, Safari, etc.).
- An internet connection (to fetch movie data from the API).

### 2. File Structure
Ensure your directory looks like this:
```text
MovieApp/
├── index.html
├── css/
│   ├── style.css
│   └── normalize.css
└── js/
    └── main.js
```

### 3. API Key
The project currently uses a demo API key in `js/main.js`. For long-term use or high traffic, you should obtain your own key from [The Movie Database (TMDb)](https://www.themoviedb.org/documentation/api).

### 4. Running the App
- Simply open the `index.html` file in your preferred browser.
- You can do this by double-clicking the file or right-clicking and selecting "Open with...".

## How it Works

1. **Fetching Data**: When the page loads, `getMovies()` is called with the `API_URL` to fetch the most popular movies.
2. **Displaying Movies**: The `showMovies()` function clears the current list and creates new `div` elements for each movie result, injecting them into the `#movieList` container.
3. **Searching**: When a user submits the search form, the app intercepts the event, takes the search term, and calls `getMovies()` with the `SEARCH_API` endpoint.
4. **Interactive UI**: CSS transitions handle the sliding "Overview" panel when you hover over a movie card.

## License
This project is for educational purposes. All movie data and images are provided by TMDb.
