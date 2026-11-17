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

@route("/api/meeting-types")
@get
op listMeetingTypes(): OkResponse & { @body body: MeetingType[] };
