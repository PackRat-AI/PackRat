import { useState } from 'react';

const useSearchInput = ({ onSelect, onChange, searchString }) => {
  const [isLoadingMobile, setIsLoadingMobile] = useState(false);
  const showSearchResults = !!searchString;

  const handleSearchResultClick = (result) => {
    if (onSelect) {
      const newSearchValue = onSelect(result);
      onChange(newSearchValue);
    }
  };

  const handleClearSearch = () => {
    onChange('');
  };

  const handleSearchChange = (text) => {
    onChange(text);
  };

  return {
    searchString,
    showSearchResults,
    handleSearchResultClick,
    handleClearSearch,
    handleSearchChange,
    isLoadingMobile,
  };
};

export default useSearchInput;
