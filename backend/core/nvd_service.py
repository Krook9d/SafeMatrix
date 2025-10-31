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

    def fetch_vulnerabilities_page(self, start_index: int = 0, last_mod_start_date: str = None, last_mod_end_date: str = None) -> dict | None:
        """
        Fetches a single page of CVEs from the NVD API.
        
        Args:
            start_index: Starting index for pagination
            last_mod_start_date: Filter by last modification start date (ISO 8601 format)
            last_mod_end_date: Filter by last modification end date (ISO 8601 format)
        """
        params = {
            'resultsPerPage': RESULTS_PER_PAGE,
            'startIndex': start_index
        }
        
        if last_mod_start_date:
            params['lastModStartDate'] = last_mod_start_date
        if last_mod_end_date:
            params['lastModEndDate'] = last_mod_end_date
        
        try:
            logger.info(f"Fetching NVD data page starting at index {start_index}...")
            response = requests.get(NVD_API_BASE_URL, headers=self.headers, params=params, timeout=30)
            response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"An error occurred while fetching NVD data: {e}")
            return None

    def fetch_cve_by_id(self, cve_id: str) -> dict | None:
        """
        Fetches a single CVE by its ID from the NVD API.
        """
        params = {'cveId': cve_id}
        try:
            logger.info(f"Fetching NVD data for CVE {cve_id}...")
            response = requests.get(NVD_API_BASE_URL, headers=self.headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            if data.get('vulnerabilities'):
                # Return the 'cve' object which contains all details
                return data['vulnerabilities'][0]['cve']
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"An error occurred while fetching CVE {cve_id}: {e}")
            return None

    def sync_all_vulnerabilities(self):
        """
        Iterates through all pages of the NVD CVE data and yields vulnerabilities.
        This is a generator function to be memory-efficient.
        """
        start_index = 0
        total_results = 1  # Initialize to a non-zero value
        rejected_skipped_total = 0

        while start_index < total_results:
            data = self.fetch_vulnerabilities_page(start_index)
            
            if not data:
                logger.error("Failed to fetch data page, stopping sync.")
                break

            vulnerabilities = data.get('vulnerabilities', [])
            total_results = data.get('totalResults', 0)
            
            logger.info(f"Successfully fetched {len(vulnerabilities)} vulnerabilities. Total results: {total_results}.")

            rejected_skipped_page = 0
            for cve_item in vulnerabilities:
                cve = cve_item['cve']
                status = str(cve.get('vulnStatus', '')).strip().lower()
                if status == 'rejected':
                    rejected_skipped_page += 1
                    continue
                yield cve

            if rejected_skipped_page:
                rejected_skipped_total += rejected_skipped_page
                logger.info(
                    f"Skipped {rejected_skipped_page} rejected CVEs on this page (cumulative skipped: {rejected_skipped_total})."
                )

            start_index += RESULTS_PER_PAGE
            
            # If we are not done, wait before the next request
            if start_index < total_results:
                logger.info(f"Waiting for {WAIT_TIME_SECONDS} seconds before next request...")
                time.sleep(WAIT_TIME_SECONDS)
        
        logger.info("Finished syncing all vulnerabilities from NVD.")

    def sync_vulnerabilities_by_date(self, last_mod_start_date: str, last_mod_end_date: str):
        """
        Iterates through CVEs modified within a specific date range.
        This is useful for continuous monitoring to fetch only recent updates.
        
        Args:
            last_mod_start_date: Start date for last modification filter (ISO 8601 format)
            last_mod_end_date: End date for last modification filter (ISO 8601 format)
            
        Yields:
            CVE objects modified within the specified date range
        """
        start_index = 0
        total_results = 1
        rejected_skipped_total = 0
        
        logger.info(f"Fetching CVEs modified between {last_mod_start_date} and {last_mod_end_date}")
        
        while start_index < total_results:
            data = self.fetch_vulnerabilities_page(
                start_index=start_index,
                last_mod_start_date=last_mod_start_date,
                last_mod_end_date=last_mod_end_date
            )
            
            if not data:
                logger.error("Failed to fetch data page, stopping sync.")
                break
            
            vulnerabilities = data.get('vulnerabilities', [])
            total_results = data.get('totalResults', 0)
            
            logger.info(f"Fetched {len(vulnerabilities)} vulnerabilities. Total in range: {total_results}")
            
            rejected_skipped_page = 0
            for cve_item in vulnerabilities:
                cve = cve_item['cve']
                status = str(cve.get('vulnStatus', '')).strip().lower()
                if status == 'rejected':
                    rejected_skipped_page += 1
                    continue
                yield cve
            
            if rejected_skipped_page:
                rejected_skipped_total += rejected_skipped_page
                logger.info(
                    f"Skipped {rejected_skipped_page} rejected CVEs (cumulative: {rejected_skipped_total})"
                )
            
            start_index += RESULTS_PER_PAGE
            
            # If we are not done, wait before the next request
            if start_index < total_results:
                logger.info(f"Waiting for {WAIT_TIME_SECONDS} seconds before next request...")
                time.sleep(WAIT_TIME_SECONDS)
        
        logger.info(f"Finished syncing vulnerabilities in date range.")

# Example of how to use it (will be moved to the sync script)
if __name__ == '__main__':
    service = NVDService()
    for cve in service.sync_all_vulnerabilities():
        logger.info(f"Processing CVE: {cve['id']}")