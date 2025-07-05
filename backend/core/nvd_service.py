import time
import requests
import logging

from .config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NVD_API_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
RESULTS_PER_PAGE = 2000  # NVD API max is 2000
WAIT_TIME_SECONDS = 6    # As recommended by NVD documentation

class NVDService:
    def __init__(self, api_key: str | None = settings.nvd_api_key):
        if not api_key:
            logger.warning("NVD_API_KEY is not set. Requests will be anonymous and heavily rate-limited.")
        self.api_key = api_key
        self.headers = {'apiKey': self.api_key} if self.api_key else {}

    def fetch_vulnerabilities_page(self, start_index: int = 0) -> dict | None:
        """
        Fetches a single page of CVEs from the NVD API.
        """
        params = {
            'resultsPerPage': RESULTS_PER_PAGE,
            'startIndex': start_index
        }
        
        try:
            logger.info(f"Fetching NVD data page starting at index {start_index}...")
            response = requests.get(NVD_API_BASE_URL, headers=self.headers, params=params, timeout=30)
            response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"An error occurred while fetching NVD data: {e}")
            return None

    def sync_all_vulnerabilities(self):
        """
        Iterates through all pages of the NVD CVE data and yields vulnerabilities.
        This is a generator function to be memory-efficient.
        """
        start_index = 0
        total_results = 1  # Initialize to a non-zero value

        while start_index < total_results:
            data = self.fetch_vulnerabilities_page(start_index)
            
            if not data:
                logger.error("Failed to fetch data page, stopping sync.")
                break

            vulnerabilities = data.get('vulnerabilities', [])
            total_results = data.get('totalResults', 0)
            
            logger.info(f"Successfully fetched {len(vulnerabilities)} vulnerabilities. Total results: {total_results}.")

            for cve_item in vulnerabilities:
                yield cve_item['cve']

            start_index += RESULTS_PER_PAGE
            
            # If we are not done, wait before the next request
            if start_index < total_results:
                logger.info(f"Waiting for {WAIT_TIME_SECONDS} seconds before next request...")
                time.sleep(WAIT_TIME_SECONDS)
        
        logger.info("Finished syncing all vulnerabilities from NVD.")

# Example of how to use it (will be moved to the sync script)
if __name__ == '__main__':
    service = NVDService()
    for cve in service.sync_all_vulnerabilities():
        logger.info(f"Processing CVE: {cve['id']}") 