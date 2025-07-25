import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export const colors = [
    "blue",
    "green",
    "yellow",
    "red",
    "purple",
    "orange",
    "pink",
    "indigo",
    "turquoise",
    "teal",
    "lavender",
    "ivory",
    "mustard",
    "white",
    "grey",
    "coral",
    "amber",
    "mint",
    "emerald",
    "periwinkle",
    "cyan",
    "magenta",
    "beige",
    "gold",
    "silver",
    "peach",
    "rose",
    "crimson",
    "lilac",
    "salmon",
    "tan",
    "khaki",
];
// Add this to your colors.ts file:
export const colorNameToHex: Record<string, string> = {
    blue: "#3B82F6",
    green: "#22C55E", 
    yellow: "#EAB308",
    red: "#EF4444",
    purple: "#A855F7",
    orange: "#F97316",
    pink: "#EC4899",
    indigo: "#6366F1",
    turquoise: "#14B8A6",
    teal: "#0D9488",
    lavender: "#C4B5FD",
    ivory: "#FFFBEB",
    mustard: "#CA8A04",
    white: "#FFFFFF",
    grey: "#6B7280",
    coral: "#FB7185",
    amber: "#F59E0B",
    mint: "#6EE7B7",
    emerald: "#10B981",
    periwinkle: "#93C5FD",
    cyan: "#22D3EE",
    magenta: "#EC4899",
    beige: "#F5F5DC",
    gold: "#FFD700",
    silver: "#C0C0C0",
    peach: "#FFCBA4",
    rose: "#FB7185",
    crimson: "#DC143C",
    lilac: "#DDA0DD",
    salmon: "#FA8072",
    tan: "#D2B48C",
    khaki: "#F0E68C",
};

export const getHexFromColorName = (colorName: string): string => {
    return colorNameToHex[colorName] || "#6B7280"; // Default to gray if not found
};

export const colors_class: Record<string, string> = {
    blue: "bg-blue-200 hover:bg-blue-300 border-blue-400",
    green: "bg-green-200 hover:bg-green-300 border-green-400",
    red: "bg-red-200 hover:bg-red-300 border-red-400",
    yellow: "bg-yellow-200 hover:bg-yellow-300 border-yellow-400",
    purple: "bg-purple-200 hover:bg-purple-300 border-purple-400",
    orange: "bg-orange-200 hover:bg-orange-300 border-orange-400",
    pink: "bg-pink-200 hover:bg-pink-300 border-pink-400",
    indigo: "bg-indigo-200 hover:bg-indigo-300 border-indigo-400",
    turquoise: "bg-teal-200 hover:bg-teal-300 border-teal-400",
    teal: "bg-teal-600 hover:bg-teal-700 border-teal-800",
    lavender: "bg-purple-200 hover:bg-purple-300 border-purple-400",
    ivory: "bg-neutral-100 hover:bg-neutral-200 border-neutral-300",
    mustard: "bg-yellow-600 hover:bg-yellow-700 border-yellow-800",
    white: "bg-white hover:bg-neutral-100 border-neutral-300",
    grey: "bg-neutral-400 hover:bg-neutral-500 border-neutral-600",
    coral: "bg-orange-300 hover:bg-orange-400 border-orange-500",
    amber: "bg-amber-500 hover:bg-amber-600 border-amber-700",
    mint: "bg-emerald-200 hover:bg-emerald-300 border-emerald-400",
    emerald: "bg-emerald-500 hover:bg-emerald-600 border-emerald-700",
    periwinkle: "bg-blue-300 hover:bg-blue-400 border-blue-500",
    cyan: "bg-cyan-300 hover:bg-cyan-400 border-cyan-500",
    magenta: "bg-pink-500 hover:bg-pink-600 border-pink-700",
    beige: "bg-neutral-200 hover:bg-neutral-300 border-neutral-400",
    gold: "bg-yellow-500 hover:bg-yellow-600 border-yellow-700",
    silver: "bg-neutral-300 hover:bg-neutral-400 border-neutral-500",
    peach: "bg-orange-200 hover:bg-orange-300 border-orange-400",
    rose: "bg-rose-300 hover:bg-rose-400 border-rose-500",
    crimson: "bg-red-600 hover:bg-red-700 border-red-800",
    lilac: "bg-purple-300 hover:bg-purple-400 border-purple-500",
    salmon: "bg-red-300 hover:bg-red-400 border-red-500",
    tan: "bg-amber-300 hover:bg-amber-400 border-amber-500",
    khaki: "bg-yellow-800 hover:bg-yellow-900 border-yellow-950",
};


/// Function to get a capitalized color name
export const getColorName = (color: string): string => {
    return color.charAt(0).toUpperCase() + color.slice(1);
};

// Function to consistently assign colors based on course code
export const getConsistentCourseColor = (courseCode: string): string => {
    if (!courseCode) return colors_class.blue; // fallback color
    
    // Use course code to generate a consistent hash
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
        const char = courseCode.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Get absolute value and map to color array
    const colorKeys = Object.keys(colors_class);
    const colorIndex = Math.abs(hash) % colorKeys.length;
    const colorKey = colorKeys[colorIndex];
    
    return colors_class[colorKey];
};

// Alternative simpler version if you prefer (more predictable)
export const getSimpleCourseColor = (courseCode: string): string => {
    if (!courseCode) return colors_class.blue; // fallback color
    
    const colorKeys = Object.keys(colors_class);
    const colorIndex = courseCode.charCodeAt(0) % colorKeys.length;
    const colorKey = colorKeys[colorIndex];
    
    return colors_class[colorKey];
};

// Export the one you want to use as the default
export const getCourseColor = getConsistentCourseColor;



export const getColorClass = (color: string): string => {
    // Extract just the background color class from your colors_class
    const fullClass = colors_class[color];
    if (!fullClass) return 'bg-gray-200'; // fallback
    
    // Extract the first bg-* class (before any hover or border classes)
    const bgClass = fullClass.split(' ')[0];
    return bgClass;
};

// Color Selection Component using your existing color system
export const ColorSelectItem = ({ color, children }: { color: string, children: React.ReactNode }) => (
    <SelectItem key={color} value={color}>
        <div className="flex items-center gap-2">
            <div 
                className={`w-4 h-4 rounded border border-gray-300 flex-shrink-0 ${getColorClass(color)}`}
            />
            <span>{children}</span>
        </div>
    </SelectItem>
);

// Color Select Trigger with color indicator
export const ColorSelectTrigger = ({ value, placeholder }: { value?: string, placeholder: string }) => (
    <SelectTrigger className="border-gray-300 focus:border-[#2F2F85] focus:ring-[#2F2F85] text-sm">
        {value ? (
            <div className="flex items-center gap-2 w-full">
                <div 
                    className={`w-4 h-4 rounded border border-gray-300 flex-shrink-0 ${getColorClass(value)}`}
                />
                <span className="capitalize">{value}</span>
            </div>
        ) : (
            <SelectValue placeholder={placeholder} />
        )}
    </SelectTrigger>
);
// Add this to colors.ts
export const getColorNameFromHex = (hexColor: string): string => {
    // Reverse lookup: find color name from hex value
    for (const [colorName, hexValue] of Object.entries(colorNameToHex)) {
        if (hexValue.toLowerCase() === hexColor.toLowerCase()) {
            return colorName;
        }
    }
    return "gray"; // Default fallback
};