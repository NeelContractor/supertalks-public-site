/**
 * Rewrites a Cloudinary secure_url to request a fixed-size, cropped,
 * auto-optimized version — without needing to re-upload or touch the
 * signing flow.
 *
 * Works on any existing stored URL, e.g.:
 * https://res.cloudinary.com/aasdasd/image/upload/v123/storly/infinity/v1/abc.jpg
 * →
 * https://res.cloudinary.com/aasdasd/image/upload/c_fill,g_auto,w_800,h_800,q_auto,f_auto/v123/storly/infinity/v1/abc.jpg
 */
export function getCloudinaryUrl(
    url: string | undefined | null,
    size = 800
): string {
    if (!url) return '';
    if (!url.includes('/upload/')) return url; // not a cloudinary url, leave as-is

    const transformation = `c_fill,g_auto,w_${size},h_${size},q_auto,f_auto`;

    // If we've already injected a transformation before (e.g. re-render), don't double it
    const [prefix, rest] = url.split('/upload/');
    return `${prefix}/upload/${transformation}/${rest}`;
}