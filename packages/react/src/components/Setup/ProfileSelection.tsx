import {
  Box,
  Button,
  Checkbox,
  ColumnLayout,
  Container,
  Form,
  FormField,
  Header,
  Link,
  Select,
  SelectProps,
  Spinner,
  Tiles
} from "@awsui/components-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useHistory } from "react-router";

import { externalUrls } from "../../constants/externalUrls";
import { init, setProfileSet } from "../../store/actions/backend";
import { InfoLink } from "../InfoLink";
import styles from "./ProfileSelection.module.scss";
import { ProfileSelectionModal } from "./ProfileSelectionModal";

interface Props {
  title: string;
  buttonText: string;
  next?: () => void;
}

type FormData = {
  profileSelection: string;
  targetFrameworkSelection: SelectProps.Option;
  share: boolean;
  email: string;
};

const ProfileSelecionInternal: React.FC<Props> = ({ title, next, buttonText }) => {
  const { control, errors, handleSubmit, setError, formState } = useForm<FormData>();
  const [profileOptions, setProfileOptions] = useState(new Array<SelectProps.Option>());
  const [showModal, setShowModal] = useState(false);
  const history = useHistory();
  const { isSubmitting } = formState;
  const dispatch = useDispatch();
  const currentProfile = window.electron.getState("profile");
  const cachedTargetFramework = window.electron.getState("targetFramework");
  const currentTargetFramework =
    cachedTargetFramework.id === "netstandard2.1"
      ? {}
      : {
          label: cachedTargetFramework.label,
          value: cachedTargetFramework.id
        };

  const [targetFramework, setTargetFramework] = useState(currentTargetFramework);
  const [profiles, setProfiles] = useState({ label: currentProfile, id: "" } as SelectProps.Option);
  const [defaultCredentialsAccessKeyID, setDefaultCredentialsAccessKeyID] = useState("");
  const [useDefaultCredentials, setUseDefaultCredentials] = useState(false);
  const enableDefaultCredentials = true;
  const [profileErrorText, setProfileErrorText] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(currentProfile);


  useEffect(() => {
    window.electron
      .getProfiles()
      .then(profiles => {
        const allProfiles = Object.assign(profiles.configFile, profiles.credentialsFile);
        setProfileOptions(
          Object.keys(allProfiles).map((profileName, index) => ({
            label: profileName,
            id: index
          }))
        );
      })
      .catch(err => console.log(`Failed to get profiles ${err.stack}`));
  }, []);

  // Set Default Profile
  useEffect(() => {
    if (!useDefaultCredentials && !selectedProfile && profileOptions.length > 0) {
      const selectedId = currentProfile || profileOptions[0].label || "";
      setSelectedProfile(selectedId);
    }
  }, [useDefaultCredentials, selectedProfile, profileOptions, currentProfile]);

  // Retrieve AWS SDK default credentials     
  useEffect(() => {
    window.electron
    .getCredentials()
    .then(credentials => {
      setDefaultCredentialsAccessKeyID(credentials?.accessKeyId || "");
    }).catch(err => console.log(`Failed to retrieve AWS SDK default credentials ${err.stack}`));
  }, [useDefaultCredentials]);
  
  const actionButton = useMemo(
    () => (
      <div>
        {isSubmitting && <Spinner />}
        <Button variant="link" formAction="none" onClick={() => history.goBack()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button id="next-btn" variant="primary" formAction="submit" disabled={isSubmitting}>
          {buttonText}
        </Button>
      </div>
    ),
    [buttonText, history, isSubmitting]
  );

  const onUseDefaultCredentialsChanged = (event: { detail: { value: string; }; }) => {
    const useDefault = event.detail.value === "default";
    setUseDefaultCredentials(useDefault);     
    let selectedId = selectedProfile;     
    if (useDefault) {
      selectedId = "";     
      setSelectedProfile("");
      window.electron.saveState("useDefaultCreds", true);
    } else {     
      selectedId =  window.electron.getState("profile") || profileOptions[0]?.label || "";
      window.electron.saveState("useDefaultCreds", false);
    }
    validateProfile(selectedId, defaultCredentialsAccessKeyID, useDefault);
  }

  const onSelectProfile = useCallback(([e]) => {
    setProfiles(e.detail.selectedOption);
    setSelectedProfile(e.detail.selectedOption.label);
    validateProfile(selectedProfile, defaultCredentialsAccessKeyID, false);
    return e.detail.selectedOption.label;
  }, [defaultCredentialsAccessKeyID, selectedProfile]);

  const onSelectTargetFramework = useCallback(([e]) => {
    setTargetFramework(e.detail.selectedOption);
    return e.detail.selectedOption;
  }, []);

  const onCheckbox = useCallback(([e]) => {
    return e.detail.checked;
  }, []);

  const onAddProfile = useCallback(
    (profileName: string) => {
      const newProfileOption = { label: profileName, id: String(profileOptions.length) };
      setProfileOptions([...profileOptions, newProfileOption]);
    },
    [profileOptions]
  );

  const validateProfile = (profile: string, accessKeyID: string, useDefault: boolean): boolean => {
    let isValid = true;
    if ((!useDefault && !profile) || (useDefault && !accessKeyID)) {
      isValid = false;
      setProfileErrorText("AWS named profile is required.");
    } else {
      setProfileErrorText("");
    }
    return isValid;
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit(async data => {
          const isValidProile = validateProfile(selectedProfile, defaultCredentialsAccessKeyID, useDefaultCredentials);
          if (!isValidProile) {
            return;
          }
          if (await window.electron.verifyUser(selectedProfile)) {
            if (data.targetFrameworkSelection.value == null || data.targetFrameworkSelection.label == null) {
              setError("targetFrameworkSelection", "required", "Target Framework is required.");
              return;
            }
            window.electron.saveState("profile", selectedProfile);
            window.electron.saveState("lastConfirmVersion", "1.3.0");
            window.electron.saveState("share", data.share);
            window.electron.saveState("targetFramework", {
              id: data.targetFrameworkSelection.value,
              label: data.targetFrameworkSelection.label
            });
            // Wait for C# backend to restart
            await new Promise(resolve => setTimeout(resolve, 10000));
            dispatch(init(true));
            dispatch(setProfileSet(true));
            // set pending message and go back to settings dashboard
            next && next();
          } else {
            setError(
              "profileSelection",
              "error",
              `${selectedProfile || "Default Profile"} does not have the correct IAM policies. If you need help setting up your profile see Learn more above.`
            );
          }
        })}
      >
        <Form
          header={
            <Header
              variant="h1"
              info={
                <InfoLink
                  heading={title}
                  mainContent={
                    <p>
                      When you start the assessment tool for the first time, you are prompted to enter your AWS CLI
                      profile information so that Porting Assistant for .NET can collect metrics to improve your
                      experience. These metrics also help flag issues with the software for AWS to quickly address. If
                      you have not set up your AWS CLI profile, see Configuring the AWS CLI below.
                    </p>
                  }
                  learnMoreLinks={[
                    {
                      text: "Configuring the AWS CLI",
                      externalUrl:
                        "https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration"
                    }
                  ]}
                />
              }
            >
              {title}
            </Header>
          }
          actions={actionButton}
        >
          <Container header={<Header variant="h2">Porting Assistant for .NET settings</Header>}>
            <ColumnLayout>
              <div>
                <Box fontSize="body-m">Target framework</Box>
                <Box fontSize="body-s" margin={{ right: "xxs" }} color="text-body-secondary">
                  Select a target framework to allow Porting Assistant for .NET to assess your solution for .NET Core
                  compatibility.
                </Box>
                <div className={styles.select}>
                  <FormField id="targetFramework-selection" errorText={errors.targetFrameworkSelection?.message}>
                    <Controller
                      as={Select}
                      options={targetFrameworkOptions}
                      selectedOption={targetFramework}
                      control={control}
                      onChange={onSelectTargetFramework}
                      name="targetFrameworkSelection"
                      rules={{ required: "Target Framework is required" }}
                      defaultValue={currentTargetFramework}
                    />
                  </FormField>
                </div>
              </div>
              <div>
                <Box fontSize="body-m">Profile Selection</Box>
                <Box fontSize="body-s" margin={{ right: "xxs" }} color="text-body-secondary">
                  Select an AWS Profile to allow Porting Assistant for .NET to access your application. You can also add an AWS named profile using the AWS CLI.
                </Box>
                <FormField id="profile-selection" errorText={profileErrorText}>
                {enableDefaultCredentials && <Tiles
                onChange={onUseDefaultCredentialsChanged}
                value={useDefaultCredentials? "default" : "custom"}
                items={[
                  { label: "Select a custom named profile", value: "custom" },
                  { label: "Use existing AWS SDK/CLI credentials", value: "default" }
                ]}
              />}
              {enableDefaultCredentials && <p></p>}
              {
                useDefaultCredentials && 
                <div>
                  <div className="awsui-util-label">AWS access key ID</div>
                  {/* TODO: Add or condition */}
                  <div>{defaultCredentialsAccessKeyID}</div>
                </div>
              }
              {
                !useDefaultCredentials &&
                <div>
                <div>
                <Box fontSize="body-m">AWS named profile</Box>
                <Box fontSize="body-s" margin={{ right: "xxs" }} color="text-body-secondary">
                  Select an AWS profile to allow Porting Assistant for .NET to assess your solution for .NET Core
                  compatibility. You can also add an AWS named profile using the AWS CLI.{" "}
                  <Link
                    href="#/"
                    external
                    fontSize="body-s"
                    onFollow={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      window.electron.openExternalUrl(
                        "https://docs.aws.amazon.com/portingassistant/latest/userguide/porting-assistant-prerequisites.html#porting-assistant-iam-profile"
                      );
                    }}
                  >
                    Learn more
                  </Link>
                </Box>
                <div className={styles.select}>
                  <FormField
                    id="profile-selection"
                    errorText={errors.profileSelection?.message}
                    constraintText={
                      <Link
                        href="#/"
                        fontSize="body-s"
                        id="add-named-profile"
                        variant="primary"
                        onFollow={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          setShowModal(true);
                        }}
                      >
                        Add a named profile
                      </Link>
                    }
                  >
                    <Controller
                      as={Select}
                      options={profileOptions}
                      control={control}
                      selectedOption={profiles}
                      onChange={onSelectProfile}
                      name="profileSelection"
                      rules={{ required: "Profile is required" }}
                      defaultValue={currentProfile}
                      empty={
                        <Box variant="small">
                          You have no profiles.{" "}
                          <Link
                            href="#/"
                            onFollow={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              setShowModal(true);
                            }}
                          >
                            Add a profile
                          </Link>
                        </Box>
                      }
                    />
                  </FormField>
                </div>
              </div>                  
                </div>
              }
                </FormField>
              </div>
              <div>
                <Box fontSize="body-m">Porting Assistant for .NET data usage sharing</Box>
                {/* #7f7f7f */}
                <Box fontSize="body-s" color="text-body-secondary">
                  When you share your usage data, Porting Assistant for .NET will collect information only about the
                  public NuGet packages, APIs, build errors and stack traces. This information is used to make the
                  Porting Assistant for .NET product better, for example, to improve the package and API replacement
                  recommendations. Porting Assistant for .NET does not collect any identifying information about you.{" "}
                  <Link
                    external
                    href="#/"
                    fontSize="body-s"
                    onFollow={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      window.electron.openExternalUrl(externalUrls.howItWorks);
                    }}
                  >
                    Learn more
                  </Link>
                </Box>
              </div>
              <FormField>
                <Controller
                  as={shareCheckbox}
                  name="share"
                  control={control}
                  onChange={onCheckbox}
                  defaultValue={true}
                />
              </FormField>
            </ColumnLayout>
          </Container>
        </Form>
      </form>
      <div className={styles.modal}>
        <ProfileSelectionModal
          onAddProfile={onAddProfile}
          showModal={showModal}
          onSetModalVisibility={show => setShowModal(show)}
        />
      </div>
    </div>
  );
};

const shareCheckbox = (
  <Checkbox checked={false}>
    <Box variant="div">
      I agree to share my usage data with Porting Assistant for .NET - <i>optional</i>
      <Box variant="div" fontSize="body-s" color="text-body-secondary">
        You can change this setting at any time on the Porting Assistant for .NET Settings page.
      </Box>
    </Box>
  </Checkbox>
);

export const targetFrameworkOptions: SelectProps.Option[] = [
  { label: ".NET 6.0.0", value: "net6.0" },
  { label: ".NET 5.0.0", value: "net5.0" },
  { label: ".NET Core 3.1.0", value: "netcoreapp3.1" }
];

export const ProfileSelecion = React.memo(ProfileSelecionInternal);
