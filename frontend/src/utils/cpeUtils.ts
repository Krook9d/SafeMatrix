// Utility functions for parsing CPE (Common Platform Enumeration) data

export interface AffectedProduct {
    vendor: string;
    product: string;
    version?: string;
    versionRange?: string;
}

/**
 * Parse CPE criteria string to extract vendor, product, and version information
 * CPE format: cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
 */
export function parseCPE(cpeString: string): AffectedProduct | null {
    try {
        if (!cpeString || typeof cpeString !== 'string') {
            return null;
        }

        const parts = cpeString.split(':');

        if (parts.length < 6 || parts[0] !== 'cpe') {
            return null;
        }

        const vendor = parts[3] === '*' || parts[3] === '-' ? 'Unknown' : decodeURIComponent(parts[3]).replace(/_/g, ' ');
        const product = parts[4] === '*' || parts[4] === '-' ? 'Unknown' : decodeURIComponent(parts[4]).replace(/_/g, ' ');
        const version = (parts[5] === '*' || parts[5] === '-') ? undefined : decodeURIComponent(parts[5]).replace(/_/g, ' ');

        return {
            vendor: capitalizeWords(vendor),
            product: capitalizeWords(product),
            version: version ? capitalizeWords(version) : undefined
        };
    } catch (error) {
        console.warn('Failed to parse CPE:', cpeString, error);
        return null;
    }
}

/**
 * Extract affected products from vulnerability configurations
 */
export function extractAffectedProducts(configurations: any[]): AffectedProduct[] {
    const products: AffectedProduct[] = [];
    const seen = new Set<string>();

    if (!configurations || configurations.length === 0) {
        return products;
    }

    configurations.forEach((config) => {
        if (!config.nodes || !Array.isArray(config.nodes)) {
            return;
        }

        config.nodes.forEach((node: any) => {
            if (!node.cpeMatch || !Array.isArray(node.cpeMatch)) {
                return;
            }

            node.cpeMatch.forEach((cpe: any) => {
                if (cpe.vulnerable) {
                    const parsed = parseCPE(cpe.criteria);

                    if (parsed) {
                        // Build version range if available
                        let versionRange = parsed.version;
                        if (cpe.versionStartIncluding || cpe.versionEndIncluding ||
                            cpe.versionStartExcluding || cpe.versionEndExcluding) {
                            const ranges = [];
                            if (cpe.versionStartIncluding) ranges.push(`>= ${cpe.versionStartIncluding}`);
                            if (cpe.versionStartExcluding) ranges.push(`> ${cpe.versionStartExcluding}`);
                            if (cpe.versionEndIncluding) ranges.push(`<= ${cpe.versionEndIncluding}`);
                            if (cpe.versionEndExcluding) ranges.push(`< ${cpe.versionEndExcluding}`);
                            versionRange = ranges.join(', ');
                        }

                        const productKey = `${parsed.vendor}:${parsed.product}:${versionRange || 'any'}`;
                        if (!seen.has(productKey)) {
                            seen.add(productKey);
                            products.push({
                                ...parsed,
                                versionRange
                            });
                        }
                    }
                }
            });
        });
    });

    return products;
}

/**
 * Get a summary of affected products for display in tables
 */
export function getAffectedProductsSummary(configurations: any[]): string {
    const products = extractAffectedProducts(configurations);

    if (products.length === 0) {
        return 'No specific products';
    }

    if (products.length === 1) {
        const product = products[0];
        return `${product.vendor} ${product.product}`;
    }

    if (products.length <= 3) {
        return products.map(p => `${p.vendor} ${p.product}`).join(', ');
    }

    const first = products[0];
    return `${first.vendor} ${first.product} and ${products.length - 1} others`;
}

/**
 * Capitalize words in a string
 */
function capitalizeWords(str: string): string {
    return str.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}