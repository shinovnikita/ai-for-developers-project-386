import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { BookingPage } from './BookingPage';

const bookingPath = '/booking';

export default function App() {
  return (
    <Container component="main" size="md" py="xl">
      <Stack align="flex-start">
        {globalThis.location.pathname === bookingPath ? (
          <BookingPage />
        ) : (
          <>
            <Title order={1}>Календарь звонков</Title>
            <Text>Здесь можно записаться на звонок к владельцу календаря без регистрации</Text>
            <Button component="a" href={bookingPath}>
              Перейти к записи
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
}
