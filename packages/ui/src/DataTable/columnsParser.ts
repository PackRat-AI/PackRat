import { createColumnHelper } from "@tanstack/react-table";

type DataType = {
      [key: string]: string | number;
    };

  export  const createColumns = <T extends DataType>(data: T[]) => {
      const columnHelper = createColumnHelper<T>();
    
      // Get the keys from the first object in the array
      const keys = Object?.keys(data[0]);
      if (keys.length > 0) {
        // Map over the keys to create columns
        const columns = keys.map((key) => {
          return columnHelper.accessor(key as keyof T, {
            cell: (info) => info.getValue(),
            footer: (info) => info.column.id,
          });
        });
        return columns;
      }
      return [];
    };
        