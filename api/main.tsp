import "@typespec/http";

using TypeSpec.Http;

@service(#{ title: "Календарь звонков" })
namespace CallCalendar;

model MeetingType {
  id: string;

  @minLength(1)
  @maxLength(80)
  name: string;

  @minLength(1)
  @maxLength(500)
  description: string;

  @minValue(5)
  @maxValue(120)
  durationMinutes: int32;
}

model CreateMeetingTypeInput {
  @doc("After trimming leading and trailing whitespace, the name must contain 1–80 characters.")
  name: string;

  @doc("After trimming leading and trailing whitespace, the description must contain 1–500 characters.")
  description: string;

  durationMinutes: MeetingType.durationMinutes;
}

model ApiError<Code extends string> {
  code: Code;
  message: string;
  fieldErrors?: Record<string>;
}

model MeetingTypeNameTakenError {
  code: "MEETING_TYPE_NAME_TAKEN";
  message: string;
  fieldErrors: { name: string };
}

@route("/api/meeting-types")
@get
op listMeetingTypes(): OkResponse & { @body body: MeetingType[] };

@route("/api/meeting-types")
@post
op createMeetingType(@body input: CreateMeetingTypeInput):
  CreatedResponse & { @body body: MeetingType }
  | BadRequestResponse & { @body body: ApiError<"VALIDATION_ERROR"> }
  | ConflictResponse & { @body body: MeetingTypeNameTakenError };
