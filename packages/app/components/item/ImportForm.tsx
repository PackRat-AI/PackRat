import React, { useState, FC } from 'react';
import { View, Platform } from 'react-native';
import { DropdownComponent, RButton, RText } from '@packrat/ui';
import useTheme from '../../hooks/useTheme';
import DocumentPicker from './DocumentPicker/DocumentPicker';
import Papa from 'papaparse';

interface ImportFormProps {
  handleSubmit: () => void;
  showSubmitButton?: boolean;
  isLoading?: boolean;
  isEdit?: boolean;
  validationSchema?: any;
}

interface SelectedType {
  label: string;
  value: string;
}

const data = [
  { label: 'CSV', value: '.csv', key: '.csv' },
  { label: 'Other', value: '*', key: '*' },
];

export const ImportForm: FC<ImportFormProps> = ({
  handleSubmit,
  showSubmitButton = true,
  isLoading,
  isEdit,
  validationSchema,
}) => {
  const { currentTheme } = useTheme();
  const [selectedType, setSelectedType] = useState<SelectedType>({
    label: 'CSV',
    value: '.csv',
  });

  const handleSelectChange = (selectedValue: string) => {
    const newValue = data.find((item) => item.value === selectedValue);
    if (newValue) setSelectedType(newValue);
  };

  const handleItemImport = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [selectedType.value],
      });
      console.log('File imported', res);

      if (selectedType.value === '.csv') {
        let fileContent;
        if (Platform.OS === 'web') {
          const file = res[0];
          fileContent = await file.text(); // On the web, read the file content directly
        } else {
          const response = await fetch(res[0].uri); // On native, fetch the file content
          fileContent = await response.text();
        }

        Papa.parse(fileContent, {
          header: true,
          complete: (result) => {
            console.log('Parsed CSV data:', result.data);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
          },
        });
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User canceled file picker');
      } else {
        console.error('Error importing file:', err);
      }
    }
  };

  return (
    <View style={{ minWidth: 320 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 10,
        }}
      >
        <DropdownComponent
          value={selectedType}
          data={data}
          onValueChange={handleSelectChange}
          placeholder={`Select file type: ${selectedType.label}`}
          native={true}
          style={{ width: '100%' }}
        />
      </View>
      <RButton onClick={handleItemImport}>
        <RText style={{ color: currentTheme.colors.text }}>Import Item</RText>
      </RButton>
    </View>
  );
};
