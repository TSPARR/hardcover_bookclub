# bookclub/hardcover_api.py
import requests


class HardcoverAPI:
    BASE_URL = "https://hardcover.app/api"  # Adjust based on actual API endpoint

    @staticmethod
    def search_books(query):
        """Search for books via the Hardcover API"""
        endpoint = f"{HardcoverAPI.BASE_URL}/books/search"
        params = {"q": query}

        response = requests.get(endpoint, params=params)
        return response.json() if response.status_code == 200 else None

    @staticmethod
    def get_book_details(book_id):
        """Get detailed information about a specific book"""
        endpoint = f"{HardcoverAPI.BASE_URL}/books/{book_id}"

        response = requests.get(endpoint)
        return response.json() if response.status_code == 200 else None

    # Add more methods as needed for the Hardcover API integration
