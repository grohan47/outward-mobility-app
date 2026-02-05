/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                "primary": "#11d432",
                "primary-dark": "#14b84b",
                "background-light": "#f6f8f6",
                "background-dark": "#102213",
            },
            fontFamily: {
                "display": ["Public Sans", "sans-serif"],
                "student": ["Lexend", "sans-serif"],
            },
        },
    },
    plugins: [
        forms,
        containerQueries,
    ],
}
