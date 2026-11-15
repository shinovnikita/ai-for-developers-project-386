import { Button, Container, Stack, Text, Title } from '@mantine/core';

const bookingPath = '/booking';

export default function App() {
  return (
    <Container component="main" size="md" py="xl">
      <Stack align="flex-start">
        {globalThis.location.pathname === bookingPath ? (
          <>
            <Title order={1}>Страница записи</Title>
            <Text>Запись откроется позже</Text>
          </>
        ) : (
          <>
            <Title order={1}>Календарь звонков</Title>
            <Text>Здесь можно записаться на звонок к владельцу календаря без регистрации</Text>
            <Stack align="flex-start" gap="xs">
              <Button component="a" href={bookingPath} aria-describedby="booking-availability">
                Перейти к записи
              </Button>
              <Text id="booking-availability" size="sm" c="dimmed">
                Запись откроется позже
              </Text>
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
}
