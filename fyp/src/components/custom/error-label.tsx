export default function ErrorLabel({
    className,
    ...props
}: React.ComponentPropsWithoutRef<'label'>) {
    return (
        <label
            className={`text-red-500 text-sm font-medium flex items-center ${className ?? ''}`}
            {...props}
        >
            <svg
                className="w-3 h-3 mr-1 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
            >
                <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                />
            </svg>
            {props.children}
        </label>
    );
}