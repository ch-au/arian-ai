import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Disable browserslist network lookups so dev startup works offline and in sandboxes
if (!process.env.BROWSERSLIST_DANGEROUS_DISABLE) {
  process.env.BROWSERSLIST_DANGEROUS_DISABLE = "1";
}

export default {
  plugins: [tailwindcss(), autoprefixer()],
};
