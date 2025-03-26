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
        else:
            logger.warning("No API key available for request")

        return headers

    @staticmethod
    def execute_query(query, variables=None, user=None):
        """Execute a GraphQL query against the Hardcover API"""
        payload = {"query": query, "variables": variables or {}}

        headers = HardcoverAPI.get_headers(user)

        try:
            response = requests.post(
                HardcoverAPI.BASE_URL, headers=headers, json=payload
            )

            if response.status_code == 200:
                data = response.json()

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

        if result and "data" in result:
            if "search" in result["data"]:
                search_data = result["data"]["search"]

                if "results" in search_data:
                    # First, check if results is a string (JSON)
                    results = search_data["results"]

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
            slug
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
                "url": f"https://hardcover.app/books/{book_data['slug']}",
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
            user_book_id
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
                    "read_id": read.get("user_book_id"),
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

    @staticmethod
    def update_reading_progress(
        user_book_read_id,
        progress=None,
        edition_id=None,
        started_at=None,
        finished_at=None,
        user=None,
    ):
        """Update a user's reading progress on Hardcover via GraphQL mutation

        Args:
            user_book_read_id (int): The ID of the user_book_read record to update
            progress (int, optional): Progress value (percentage or seconds, depending on format)
            edition_id (int, optional): The ID of the edition being read
            started_at (date, optional): Date when the user started reading
            finished_at (date, optional): Date when the user finished reading
            user (User, optional): The User object to retrieve API key from

        Returns:
            dict: Response data from the Hardcover API, or None if error occurred
        """
        logger.info(
            f"Updating Hardcover progress for user_book_read ID: {user_book_read_id}"
        )

        if (
            not user
            or not hasattr(user, "profile")
            or not user.profile.hardcover_api_key
        ):
            logger.warning("No user or API key available for update request")
            return {
                "error": "You need to add your Hardcover API key in Profile Settings to use this feature."
            }

        # Build mutation variables
        update_obj = {}
        if progress is not None:
            update_obj["progress"] = progress
        if edition_id is not None:
            update_obj["edition_id"] = edition_id
        if started_at is not None:
            # Format date as YYYY-MM-DD string if it's a datetime
            if hasattr(started_at, "strftime"):
                update_obj["started_at"] = started_at.strftime("%Y-%m-%d")
            else:
                update_obj["started_at"] = started_at
        if finished_at is not None:
            # Format date as YYYY-MM-DD string if it's a datetime
            if hasattr(finished_at, "strftime"):
                update_obj["finished_at"] = finished_at.strftime("%Y-%m-%d")
            else:
                update_obj["finished_at"] = finished_at

        # If edition is audiobook format, use progress_seconds, otherwise use progress_pages
        if progress is not None:
            reading_format_id = None

            # Check if we have edition info to determine format
            if "reading_format_id" in update_obj:
                reading_format_id = update_obj["reading_format_id"]

            # If audio format (reading_format_id = 2), convert percentage to seconds
            if reading_format_id == 2 and "edition" in update_obj:
                if update_obj["edition"].get("audio_seconds"):
                    total_seconds = update_obj["edition"]["audio_seconds"]
                    progress_seconds = int((progress / 100) * total_seconds)
                    update_obj["progress_seconds"] = progress_seconds
                    # Remove generic progress value as we're using a specific field
                    if "progress" in update_obj:
                        del update_obj["progress"]
            # For physical books or ebooks (reading_format_id 1 or 4), convert to pages
            elif reading_format_id in [1, 4] and "edition" in update_obj:
                if update_obj["edition"].get("pages"):
                    total_pages = update_obj["edition"]["pages"]
                    progress_pages = int((progress / 100) * total_pages)
                    update_obj["progress_pages"] = progress_pages
                    # Remove generic progress value as we're using a specific field
                    if "progress" in update_obj:
                        del update_obj["progress"]

        graphql_mutation = """
        mutation UpdateProgress($id: Int!, $object: user_book_reads_set_input!) {
            update_user_book_read(id: $id, _set: $object) {
                id
            }
        }
        """

        variables = {"id": int(user_book_read_id), "object": update_obj}

        result = HardcoverAPI.execute_query(graphql_mutation, variables, user)

        if result and "data" in result and "update_user_book_read" in result["data"]:
            logger.info(
                f"Successfully updated reading progress on Hardcover for ID: {user_book_read_id}"
            )
            return result["data"]["update_user_book_read"]
        else:
            logger.error(
                f"Failed to update reading progress on Hardcover for ID: {user_book_read_id}"
            )
            if result and "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
            return None

    @staticmethod
    def start_reading_progress(
        book_id, edition_id=None, pages=None, seconds=None, started_at=None, user=None
    ):
        """Start tracking a book on Hardcover via GraphQL mutation

        Args:
            book_id (int): The Hardcover book ID
            edition_id (int, optional): The ID of the edition being read
            pages (int, optional): Current page number for physical/ebook formats
            seconds (int, optional): Current position in seconds for audiobooks
            started_at (date, optional): Date when the user started reading
            user (User, optional): The User object to retrieve API key from

        Returns:
            dict: Response data with the new read_id if successful, or error message
        """
        logger.info(
            f"Starting new reading progress on Hardcover for book ID: {book_id}"
        )

        if (
            not user
            or not hasattr(user, "profile")
            or not user.profile.hardcover_api_key
        ):
            logger.warning("No user or API key available for creating progress")
            return {
                "error": "You need to add your Hardcover API key in Profile Settings to use this feature."
            }

        # First, we need to get the current user's ID from Hardcover
        # We need this to properly filter user_books by both book_id and user_id
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
            or not user_result["data"]["me"]
        ):
            logger.error("Failed to fetch user ID from Hardcover")
            return {"error": "Could not authenticate with Hardcover."}

        hardcover_user_id = user_result["data"]["me"][0]["id"]
        logger.info(f"Retrieved Hardcover user ID: {hardcover_user_id}")

        # Now, check if the user_book already exists
        user_book_query = """
        query GetUserBook($book_id: Int!, $user_id: Int!) {
            user_books(where: {book_id: {_eq: $book_id}, user_id: {_eq: $user_id}}) {
                id
                statusId: status_id
                editionId: edition_id
                datesRead: user_book_reads {
                    id
                    startedAt: started_at
                    finishedAt: finished_at
                }
            }
        }
        """

        variables = {"book_id": int(book_id), "user_id": int(hardcover_user_id)}

        user_book_result = HardcoverAPI.execute_query(user_book_query, variables, user)

        user_book_id = None
        read_id = None

        # Check if user_book already exists
        if (
            user_book_result
            and "data" in user_book_result
            and "user_books" in user_book_result["data"]
            and user_book_result["data"]["user_books"]
            and len(user_book_result["data"]["user_books"]) > 0
        ):
            # User book exists, get its ID
            user_book = user_book_result["data"]["user_books"][0]
            user_book_id = user_book["id"]
            logger.info(f"Found existing user_book with ID: {user_book_id}")

            # Update to "currently reading" status
            update_book_mutation = """
            mutation UpdateUserBook($id: Int!, $object: UserBookUpdateInput!) {
                updateResponse: update_user_book(id: $id, object: $object) {
                    error
                    userBook: user_book {
                        id
                        statusId: status_id
                        datesRead: user_book_reads {
                            id
                            startedAt: started_at
                            finishedAt: finished_at
                        }
                    }
                }
            }
            """

            update_object = {
                "status_id": 2,  # 2 = currently reading
            }

            if edition_id is not None:
                update_object["edition_id"] = edition_id

            update_variables = {"id": int(user_book_id), "object": update_object}

            logger.debug(
                f"Updating user_book to 'currently reading': {update_variables}"
            )
            update_result = HardcoverAPI.execute_query(
                update_book_mutation, update_variables, user
            )

            if (
                update_result
                and "data" in update_result
                and "updateResponse" in update_result["data"]
                and update_result["data"]["updateResponse"]
                and "userBook" in update_result["data"]["updateResponse"]
                and update_result["data"]["updateResponse"]["userBook"]
                and "datesRead" in update_result["data"]["updateResponse"]["userBook"]
            ):
                dates_read = update_result["data"]["updateResponse"]["userBook"][
                    "datesRead"
                ]
                logger.info(
                    f"Successfully updated book status, found {len(dates_read)} reading records"
                )

                # Look for an unfinished reading record
                for read in dates_read:
                    if not read.get("finishedAt"):
                        read_id = read["id"]
                        logger.info(
                            f"Found unfinished reading record with ID: {read_id}"
                        )
                        break
            else:
                logger.warning(
                    "Failed to update user_book or get updated reading records"
                )
                if update_result and "errors" in update_result:
                    logger.error(f"GraphQL errors: {update_result['errors']}")
        else:
            # User book doesn't exist, create it with status "currently reading"
            logger.info(
                "No user_book found, creating one with 'currently reading' status"
            )

            create_book_mutation = """
            mutation CreateUserBook($object: UserBookCreateInput!) {
                insertResponse: insert_user_book(object: $object) {
                    error
                    userBook: user_book {
                        id
                        statusId: status_id
                        datesRead: user_book_reads {
                            id
                            startedAt: started_at
                            finishedAt: finished_at
                        }
                    }
                }
            }
            """

            create_object = {
                "book_id": int(book_id),
                "status_id": 2,  # 2 = currently reading
                "privacy_setting_id": 1,  # 1 = public
            }

            if edition_id is not None:
                create_object["edition_id"] = edition_id

            create_variables = {"object": create_object}

            logger.debug(
                f"Creating new user_book with 'currently reading' status: {create_variables}"
            )
            create_result = HardcoverAPI.execute_query(
                create_book_mutation, create_variables, user
            )

            if (
                create_result
                and "data" in create_result
                and "insertResponse" in create_result["data"]
                and create_result["data"]["insertResponse"]
                and "userBook" in create_result["data"]["insertResponse"]
            ):
                user_book = create_result["data"]["insertResponse"]["userBook"]
                user_book_id = user_book["id"]
                logger.info(f"Successfully created user_book with ID: {user_book_id}")

                # Check if a reading record was automatically created
                if "datesRead" in user_book and user_book["datesRead"]:
                    for read in user_book["datesRead"]:
                        if not read.get("finishedAt"):
                            read_id = read["id"]
                            logger.info(f"Found new reading record with ID: {read_id}")
                            break
            else:
                logger.error("Failed to create user_book")
                if create_result and "errors" in create_result:
                    logger.error(f"GraphQL errors: {create_result['errors']}")
                return {"error": "Failed to add book to your Hardcover library."}

        # If we don't have a reading record yet, create one
        if not read_id and user_book_id:
            logger.info("No reading record found, creating one")

            # Use the DatesReadInput format that worked before
            create_read_mutation = """
            mutation StartBookProgress($user_book_id: Int!, $user_book_read: DatesReadInput!) {
                insert_user_book_read(user_book_id: $user_book_id, user_book_read: $user_book_read) {
                    id
                }
            }
            """

            read_input = {}

            if edition_id is not None:
                read_input["edition_id"] = edition_id

            if started_at is not None:
                if hasattr(started_at, "strftime"):
                    read_input["started_at"] = started_at.strftime("%Y-%m-%d")
                else:
                    read_input["started_at"] = started_at
            else:
                read_input["started_at"] = datetime.now().strftime("%Y-%m-%d")

            create_read_variables = {
                "user_book_id": int(user_book_id),
                "user_book_read": read_input,
            }

            logger.debug(f"Creating reading record: {create_read_variables}")
            create_read_result = HardcoverAPI.execute_query(
                create_read_mutation, create_read_variables, user
            )

            if (
                create_read_result
                and "data" in create_read_result
                and "insert_user_book_read" in create_read_result["data"]
            ):
                read_id = create_read_result["data"]["insert_user_book_read"]["id"]
                logger.info(f"Successfully created reading record with ID: {read_id}")
            else:
                logger.error("Failed to create reading record")
                if create_read_result and "errors" in create_read_result:
                    logger.error(f"GraphQL errors: {create_read_result['errors']}")
                # Still consider it a success if the book is in "currently reading" state
                return {
                    "success": True,
                    "warning": "Book marked as 'currently reading' but couldn't create reading record",
                    "user_book_id": user_book_id,
                }

        # Now update the reading record with progress if needed
        if read_id and (pages is not None or seconds is not None):
            logger.info(f"Updating reading record {read_id} with progress information")

            update_progress_mutation = """
            mutation UpdateReadingProgress($id: Int!, $object: DatesReadInput!) {
                update_user_book_read(id: $id, object: $object) {
                    id
                }
            }
            """

            progress_object = {}

            if pages is not None:
                progress_object["progress_pages"] = pages

            if seconds is not None:
                progress_object["progress_seconds"] = seconds

            update_progress_variables = {"id": int(read_id), "object": progress_object}

            logger.debug(f"Updating progress: {update_progress_variables}")
            progress_result = HardcoverAPI.execute_query(
                update_progress_mutation, update_progress_variables, user
            )

            if (
                not progress_result
                or "errors" in progress_result
                or "data" not in progress_result
            ):
                logger.warning(
                    f"Failed to update progress for reading record {read_id}"
                )
                if progress_result and "errors" in progress_result:
                    logger.error(f"GraphQL errors: {progress_result['errors']}")
                # Consider it a success anyway since the reading record exists

        if read_id:
            return {"success": True, "read_id": read_id, "user_book_id": user_book_id}
        elif user_book_id:
            return {
                "success": True,
                "warning": "Book marked as 'currently reading' but couldn't find or create reading record",
                "user_book_id": user_book_id,
            }
        else:
            return {"error": "Failed to start reading progress on Hardcover"}
