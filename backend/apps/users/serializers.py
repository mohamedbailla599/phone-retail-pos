from rest_framework import serializers

from apps.users.models import User


class POSUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "role"]
        read_only_fields = fields

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.username


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class SelectOperatorSerializer(serializers.Serializer):
    operator_id = serializers.IntegerField(min_value=1)
