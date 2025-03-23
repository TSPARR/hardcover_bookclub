import requests
import json
import logging

logger = logging.getLogger(__name__)


class HardcoverAPI:
    BASE_URL = "https://api.hardcover.app/v1/graphql"

    @staticmethod
    def get_headers(user=None):
        """Get request headers with the user's API key if available"""
        headers = {
            "Content-Type": "application/json",
        }

        if user and hasattr(user, "profile") and user.profile.hardcover_api_key:
            headers["Authorization"] = f"Bearer {user.profile.hardcover_api_key}"
            # logger.debug(f"Using API key for user: {user.username}")
        else:
            logger.warning("No API key available for request")

        return headers

    @staticmethod
    def execute_query(query, variables=None, user=None):
        """Execute a GraphQL query against the Hardcover API"""
        payload = {"query": query, "variables": variables or {}}

        headers = HardcoverAPI.get_headers(user)

        # logger.debug(f"GraphQL Query: {query}")
        # logger.debug(f"Variables: {variables}")

        try:
            # logger.debug(f"Sending request to {HardcoverAPI.BASE_URL}")
            response = requests.post(
                HardcoverAPI.BASE_URL, headers=headers, json=payload
            )

            # logger.debug(f"Response status code: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                # logger.debug(f"Response data: {data}")

                # Check for GraphQL errors
                if "errors" in data:
                    logger.error(f"GraphQL errors: {data['errors']}")
                    return None

                return data
            else:
                logger.error(f"API Error: {response.status_code}")
                logger.error(f"Response text: {response.text}")
                return None

        except Exception as e:
            logger.exception(f"Request Error: {str(e)}")
            return None

    @staticmethod
    def search_books(query, page=1, per_page=10, user=None):
        """Search for books via the Hardcover GraphQL API"""
        logger.info(f"Searching for books with query: '{query}'")

        graphql_query = """
        query SearchBooks($query: String!, $page: Int!, $perPage: Int!) {
        search(
            query: $query,
            query_type: "Book",
            per_page: $perPage,
            page: $page
        ) {
            results
        }
        }
        """

        variables = {"query": query, "page": page, "perPage": per_page}

        result = HardcoverAPI.execute_query(graphql_query, variables, user)
        # logger.debug(f"Raw search result: {result}")

        if result and "data" in result:
            if "search" in result["data"]:
                search_data = result["data"]["search"]
                # logger.debug(f"Search data: {search_data}")

                if "results" in search_data:
                    # First, check if results is a string (JSON)
                    results = search_data["results"]
                    # logger.debug(f"Results type: {type(results)}")

                    if isinstance(results, str):
                        # If it's a string, try to parse it as JSON
                        try:
                            parsed_results = json.loads(results)
                            if "hits" in parsed_results and isinstance(
                                parsed_results["hits"], list
                            ):
                                books = parsed_results["hits"]
                                logger.info(f"Found {len(books)} books")
                                return books
                            else:
                                logger.warning(
                                    "Parsed JSON doesn't contain 'hits' array"
                                )
                                return []
                        except json.JSONDecodeError as e:
                            logger.error(f"JSON decode error: {e}")
                            return []
                    elif isinstance(results, dict):
                        # If it's already a dict, check for hits
                        if "hits" in results and isinstance(results["hits"], list):
                            books = results["hits"]
                            logger.info(f"Found {len(books)} books")
                            return books
                        else:
                            logger.warning("Result dict doesn't contain 'hits' array")
                            # logger.debug(f"Result structure: {results.keys()}")
                            return []
                    else:
                        logger.error(f"Unexpected result type: {type(results)}")
                        return []
                else:
                    logger.warning("No 'results' field in search data")
            else:
                logger.warning("No 'search' field in response data")
        else:
            logger.warning("Invalid response format or no data received")

        logger.info("No books found for the search query")
        return []

    @staticmethod
    def get_book_details(hardcover_id, user=None):
        """Get detailed information about a book from the Hardcover API"""
        logger.info(f"Getting details for book ID: {hardcover_id}")

        if not hardcover_id:
            logger.error("No hardcover_id provided")
            return None

        graphql_query = """
        query GetBookDetails($id: Int!) {
        books_by_pk(id: $id) {
            id
            title
            description
            cached_image
            cached_contributors
        }
        }
        """

        variables = {"id": int(hardcover_id)}

        result = HardcoverAPI.execute_query(graphql_query, variables, user)

        if result and "data" in result and "books_by_pk" in result["data"]:
            book_data = result["data"]["books_by_pk"]
            logger.info(
                f"Successfully retrieved details for book: {book_data.get('title', 'Unknown')}"
            )

            # Create a simplified structure for book data
            processed_data = {
                "id": book_data["id"],
                "title": book_data["title"],
                "description": book_data["description"],
            }

            # Add cover image URL
            if book_data.get("cached_image") and book_data["cached_image"].get("url"):
                processed_data["cover_image_url"] = book_data["cached_image"]["url"]

            # Add author information
            if (
                book_data.get("cached_contributors")
                and len(book_data["cached_contributors"]) > 0
            ):
                contributor = book_data["cached_contributors"][0]
                if contributor.get("author"):
                    processed_data["author"] = {"name": contributor["author"]["name"]}

            return processed_data
        else:
            logger.error(f"Failed to retrieve book details for ID: {hardcover_id}")
            if result and "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
            return None
