import requests
import json
import logging
from datetime import datetime

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

    @staticmethod
    def get_reading_progress(book_id, user=None):
        """Get user's reading progress for a specific book from the Hardcover API"""
        logger.info(f"Getting reading progress for book ID: {book_id}")

        if (
            not user
            or not hasattr(user, "profile")
            or not user.profile.hardcover_api_key
        ):
            logger.warning("No user or API key available for progress request")
            return {
                "error": "You need to add your Hardcover API key in Profile Settings to use this feature."
            }

        # First, get the user_id from Hardcover
        user_id_query = """
        query ValidateAuth {
        me {
            id
            username
        }
        }
        """

        user_result = HardcoverAPI.execute_query(user_id_query, {}, user)

        if (
            not user_result
            or "data" not in user_result
            or "me" not in user_result["data"]
        ):
            logger.error("Failed to fetch user ID from Hardcover")
            return {"error": "Could not authenticate with Hardcover."}

        user_id = user_result["data"]["me"][0]["id"]

        # Now fetch reading progress using the user_id and book_id
        progress_query = """
        query GetReadingProgress($user_id: Int!, $book_id: Int!) {
        user_book_reads(
            order_by: {started_at: desc_nulls_last}
            where: {user_book: {user_id: {_eq: $user_id}, book_id: {_eq: $book_id}}}
        ) {
            progress
            progress_pages
            progress_seconds
            started_at
            finished_at
            edition {
            reading_format_id
            id
            title
            pages
            audio_seconds
            }
        }
        }
        """

        variables = {"user_id": int(user_id), "book_id": int(book_id)}

        result = HardcoverAPI.execute_query(progress_query, variables, user)

        if not result or "data" not in result:
            logger.error("Failed to fetch reading progress")
            return {"error": "Could not retrieve reading progress from Hardcover."}

        # Process the reading progress data
        progress_data = []
        try:
            reads = result["data"]["user_book_reads"]

            if not reads or len(reads) == 0:
                return {"progress": []}

            for read in reads:
                reading_format_id = read["edition"]["reading_format_id"]

                # Determine reading format
                reading_format = "book"
                if reading_format_id == 2:
                    reading_format = "audio"

                # Set current page/position based on reading format and completion status
                current_page = read["progress_pages"]
                current_position = read["progress_seconds"]
                progress_value = read["progress"] or 0

                # If the book is finished, set progress to total values
                if read["finished_at"]:
                    progress_value = 100

                    # For physical books or ebooks (format 1 or 2), use total pages
                    if reading_format_id in [1, 4] and read["edition"].get("pages"):
                        current_page = read["edition"]["pages"]

                    # For audiobooks (format 2), use total seconds
                    elif reading_format_id == 2 and read["edition"].get(
                        "audio_seconds"
                    ):
                        current_position = read["edition"]["audio_seconds"]

                progress_item = {
                    "started_at": read["started_at"],
                    "finished_at": read["finished_at"],
                    "current_page": current_page,
                    "current_position": current_position,
                    "progress": progress_value,
                    "reading_format": reading_format,
                    "reading_format_id": reading_format_id,
                    "edition": {
                        "id": read["edition"]["id"],
                        "title": read["edition"].get("title", "Unknown Edition"),
                        "pages": read["edition"].get("pages", 0),
                        "audio_seconds": read["edition"].get("audio_seconds", 0),
                    },
                }
                progress_data.append(progress_item)
        except Exception as e:
            logger.exception(f"Error processing reading progress data: {str(e)}")
            return {"error": f"Error processing data: {str(e)}"}

        return {"progress": progress_data}

    @staticmethod
    def get_book_editions(hardcover_id, user=None):
        """Get all available editions for a book from the Hardcover API"""
        logger.info(f"Getting editions for book ID: {hardcover_id}")

        if not hardcover_id:
            logger.error("No hardcover_id provided")
            return None

        graphql_query = """
        query GetBookEditions($id: Int!) {
        editions(where: {book_id: {_eq: $id}}) {
            id
            title
            cached_image
            pages
            audio_seconds
            reading_format_id
            isbn_10
            isbn_13
            publisher {
                name
            }
            release_date
        }
        }
        """

        variables = {"id": int(hardcover_id)}

        result = HardcoverAPI.execute_query(graphql_query, variables, user)

        if result and "data" in result and "editions" in result["data"]:
            editions = result["data"]["editions"]
            logger.info(
                f"Successfully retrieved {len(editions)} editions for book ID: {hardcover_id}"
            )

            # Process editions to add reading format name
            for edition in editions:
                # Add cover image URL
                if edition.get("cached_image") and edition["cached_image"].get("url"):
                    edition["cover_image_url"] = edition["cached_image"]["url"]

                # Map reading_format_id to human-readable name
                format_id = edition.get("reading_format_id")
                if format_id == 1:
                    edition["reading_format"] = "physical"
                elif format_id == 2:
                    edition["reading_format"] = "audio"
                elif format_id == 4:
                    edition["reading_format"] = "ebook"
                else:
                    edition["reading_format"] = "unknown"

                # Format publication date if present
                if edition.get("release_date"):
                    try:
                        pub_date = datetime.strptime(
                            edition["release_date"], "%Y-%m-%d"
                        )
                        edition["release_date_formatted"] = pub_date.strftime(
                            "%B %d, %Y"
                        )
                    except (ValueError, TypeError):
                        edition["release_date_formatted"] = edition["release_date"]

                # Format audio duration if present
                if edition.get("audio_seconds"):
                    hours = edition["audio_seconds"] // 3600
                    minutes = (edition["audio_seconds"] % 3600) // 60
                    edition["audio_duration_formatted"] = f"{hours}h {minutes}m"

            return editions
        else:
            logger.error(f"Failed to retrieve editions for book ID: {hardcover_id}")
            if result and "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
            return []
