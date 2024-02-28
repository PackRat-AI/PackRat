import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';
import { CustomCard } from '../card';

interface DetailsComponent {
  type: string;
  data: any; // Need type for this
  isLoading: boolean;
  error: Error;
  additionalComps: React.JSX.Element;
  link: string;
}

export const DetailsComponent = ({
  type,
  data,
  isLoading,
  error,
  additionalComps,
  link,
}: DetailsComponent) => {
  const renderDetails = () => {
    switch (type) {
      case 'pack':
        // Add pack-specific logic here
        return (
          <>
            <CustomCard
              data={data}
              title={data?.name}
              link={link}
              content={
                <>
                  {data?.description && (
                    <Text>Description: {data?.description}</Text>
                  )}

                  {additionalComps}
                </>
              }
              footer={data?.details}
              destination={null}
              type="pack"
            />
          </>
        );
      case 'trip':
        // Add trip-specific logic here
        return (
          <>
            <CustomCard
              data={data}
              title={data?.name}
              link={link}
              content={
                <>
                  {
                    <>
                      {data?.description && (
                        <Text>Description: {data?.description}</Text>
                      )}
                      {data?.destination && (
                        <Text>Destination: {data?.destination}</Text>
                      )}
                      {data.start_date && (
                        <Text>
                          Start Date:{' '}
                          {format(new Date(data.start_date), 'MM/dd/yyyy')}
                        </Text>
                      )}
                      {data.end_date && (
                        <Text>
                          End Date:{' '}
                          {format(new Date(data.end_date), 'MM/dd/yyyy')}
                        </Text>
                      )}
                    </>
                  }
                  {<View style={{ marginTop: '10%' }}>{additionalComps}</View>}
                </>
              }
              destination={data?.destination}
              footer={data?.details}
              type="trip"
            />
            {/* <View>
              <Text>{data?.title}</Text>
            </View>
            <View>
              <Text>{data?.details}</Text>
            </View> */}
          </>
        );
      case 'item':
        // Add item-specific logic here
        return (
          <>
            <View>
              <Text>{data.name}</Text>
            </View>
            <View>
              <Text>{data.description}</Text>
            </View>
          </>
        );
      default:
        // Handle unknown types
        return null;
    }
  };

  return <View>{renderDetails()}</View>;
};
