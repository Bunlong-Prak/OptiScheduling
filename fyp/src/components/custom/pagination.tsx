import React from "react";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination";


interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function CustomPagination({
    currentPage,
    totalPages,
    onPageChange,
}: PaginationProps) {
    // Generate array of page numbers to display
    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            // If we have 5 or fewer pages, show all of them
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            // Always include first page
            pageNumbers.push(1);

            // Calculate start and end of middle section
            let startPage = Math.max(2, currentPage - 1);
            const endPage = Math.min(totalPages - 1, startPage + 2);

            // Adjust if we're near the end
            if (endPage === totalPages - 1) {
                startPage = Math.max(2, endPage - 2);
            }

            // Add ellipsis if needed before middle section
            if (startPage > 2) {
                pageNumbers.push("ellipsis-start");
            }

            // Add middle section
            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(i);
            }

            // Add ellipsis if needed after middle section
            if (endPage < totalPages - 1) {
                pageNumbers.push("ellipsis-end");
            }

            // Always include last page
            pageNumbers.push(totalPages);
        }

        return pageNumbers;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="mt-6">
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() =>
                                currentPage > 1 && onPageChange(currentPage - 1)
                            }
                            className={
                                currentPage <= 1
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>

                    {pageNumbers.map((page, index) => (
                        <React.Fragment key={index}>
                            {page === "ellipsis-start" ||
                            page === "ellipsis-end" ? (
                                <PaginationItem>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            ) : (
                                <PaginationItem>
                                    <PaginationLink
                                        isActive={page === currentPage}
                                        onClick={() =>
                                            typeof page === "number" &&
                                            onPageChange(page)
                                        }
                                    >
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            )}
                        </React.Fragment>
                    ))}

                    <PaginationItem>
                        <PaginationNext
                            onClick={() =>
                                currentPage < totalPages &&
                                onPageChange(currentPage + 1)
                            }
                            className={
                                currentPage >= totalPages
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}
