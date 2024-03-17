import { Ionicons } from '@expo/vector-icons';
import {
  RInput,
  RSeparator,
  RText,
  RStack,
  RButton,
  RH5,
  RH2,
  RScrollView,
  RLabel,
  Form,
  ImageUpload,
  FormInput,
  FormSelect,
} from '@packrat/ui';
import Avatar from 'app/components/Avatar/Avatar';
import { useProfileSettings } from 'app/hooks/user';
import { z } from 'zod';

const weatherOptions = ['celsius', 'fahrenheit'].map((key) => ({
  label: key,
  value: key,
}));

const weightOptions = ['lb', 'oz', 'kg', 'g'].map((key) => ({
  label: key,
  value: key,
}));

export default function Settings() {
  const { user, handleEditUser, handlePasswordsChange, handleUpdatePassword } =
    useProfileSettings();

  return user ? (
    <RScrollView>
      <RStack
        space="$3"
        width="fit-content"
        paddingVertical={20}
        marginHorizontal="auto"
      >
        <RStack>
          <RH2>Profile</RH2>
          <RSeparator marginVertical={8} />
        </RStack>
        <Form
          onSubmit={handleEditUser}
          validationSchema={userSettingsSchema}
          defaultValues={{ ...user }}
        >
          <RStack space="$3" width="fit-content" marginHorizontal="auto">
            <ImageUpload
              label="Profile Picture"
              name="profileImage"
              previewElement={<Avatar size={90} />}
            />
            <RStack space="$3" style={{ flexDirection: 'row' }}>
              <RStack space="$2">
                <RLabel htmlFor="firstName">Name</RLabel>
                <FormInput id="name" name="name" />
              </RStack>
              <RStack space="$2">
                <RLabel htmlFor="username">Username</RLabel>
                <FormInput id="username" name="username" />
              </RStack>
            </RStack>
            <RStack space="$2">
              <RLabel htmlFor="email">Email</RLabel>
              <FormInput id="email" name="email" />
            </RStack>
            <RStack space="$2">
              <RH5>Preferred units</RH5>
              <RStack space style={{ flexDirection: 'row' }}>
                <RStack space="$2" flexGrow={1}>
                  <RLabel>Weather: </RLabel>
                  <FormSelect
                    options={weatherOptions}
                    name="preferredWeather"
                    style={{ width: '100%' }}
                  />
                </RStack>
                <RStack space="$2" flexGrow={1}>
                  <RLabel>Weight: </RLabel>
                  <FormSelect
                    options={weightOptions}
                    name="preferredWeight"
                    style={{ width: '100%' }}
                  />
                </RStack>
              </RStack>
            </RStack>
            <RButton color="white" style={{ backgroundColor: '#0284c7' }}>
              Update profile
            </RButton>
          </RStack>
        </Form>

        <RStack marginTop={20} marginBottom={10}>
          <RH2>Change Password</RH2>
          <RSeparator marginVertical={8} />
          <RText fontSize={16}>We will email you to verify the change.</RText>
        </RStack>
        <Form validationSchema={passwordChangeSchema}>
          <RStack space="$3" width="100%" marginHorizontal="auto">
            <RStack space="$2">
              <RLabel htmlFor="oldPassword">Old password</RLabel>
              <FormInput
                id="oldPassword"
                name="oldPassword"
                secureTextEntry={true}
              />
            </RStack>
            <RStack space="$2">
              <RLabel htmlFor="newPassword">New password</RLabel>
              <FormInput
                id="newPassword"
                name="newPassword"
                secureTextEntry={true}
              />
            </RStack>
            <RStack space="$2">
              <RLabel htmlFor="confirmPassword">Confirm new password</RLabel>
              <FormInput
                id="confirmPassword"
                name="confirmPassword"
                secureTextEntry={true}
              />
            </RStack>
            <RButton color="white" style={{ backgroundColor: '#0284c7' }}>
              Change password
            </RButton>
          </RStack>
        </Form>
      </RStack>
    </RScrollView>
  ) : null;
}

// TODO move to validations workspace

const userSettingsSchema = z.object({
  name: z.string().min(1).nonempty(),
  email: z.string().email().nonempty(),
  username: z.string().nonempty(),
  profileImage: z.string().optional(),
  preferredWeather: z.union([z.literal('celsius'), z.literal('fahrenheit')]),
  preferredWeight: z.union([
    z.literal('lb'),
    z.literal('oz'),
    z.literal('kg'),
    z.literal('g'),
  ]),
});

const passwordChangeSchema = z
  .object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string().nonempty(),
    confirmPassword: z.string().nonempty(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation must match',
    path: ['confirmPassword'], // This will attach the error to `passwordConfirm` field
  });
